import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AcceptedInvitation,
  INVITATION_TTL_DAYS,
  type InvitationPreview,
  type InviteInput,
  MAX_PEOPLE_PER_TABLE,
  MAX_PENDING_INVITATIONS_PER_TABLE,
  type PendingInvitation,
  type ShareRole,
  type TableShareMember,
  type TableSharing,
} from '@wisedata/shared';
import { generateSecureToken, hashToken } from '../auth/secure-token';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../database/prisma.service';
import type { Invitation, Prisma } from '../generated/prisma/client';
import { Mailer } from '../mail/mailer';
import { requireTableRole, tableRole } from '../tables/table-access';
import { invitationEmail } from './sharing-emails';

const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Invitation emails per hour, counting re-sent and revoked ones, so nobody can
 * use WiseData to flood a mailbox or send mass email.
 */
const EMAILS_PER_RECIPIENT_PER_HOUR = 5;
const INVITATIONS_PER_SENDER_PER_HOUR = 30;
const ONE_HOUR_MS = 60 * 60 * 1000;

const ROLE_RANK = { VIEWER: 1, EDITOR: 2, ADMIN: 3, OWNER: 4 } as const;

/** Pending: neither accepted nor revoked, and not expired. */
function pending(now = new Date()): Prisma.InvitationWhereInput {
  return { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } };
}

function toPendingInvitation(invitation: Invitation): PendingInvitation {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role as ShareRole,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  };
}

/** Sharing single tables with other people by email (ADR-019). */
@Injectable()
export class SharingService {
  private readonly logger = new Logger(SharingService.name);
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: Mailer,
    config: ConfigService<Env, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true });
  }

  /** Who has the table through a share, and who is invited. Admins only. */
  async sharing(userId: string, tableId: string): Promise<TableSharing> {
    await requireTableRole(this.prisma, userId, tableId, 'ADMIN');
    const [shares, invitations] = await Promise.all([
      this.prisma.tableShare.findMany({
        where: { tableId },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { email: true } } },
      }),
      this.prisma.invitation.findMany({
        where: { tableId, ...pending() },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return {
      members: shares.map((share) => ({
        userId: share.userId,
        email: share.user.email,
        role: share.role as ShareRole,
        createdAt: share.createdAt.toISOString(),
      })),
      invitations: invitations.map(toPendingInvitation),
    };
  }

  async invite(
    userId: string,
    tableId: string,
    input: Required<InviteInput>,
  ): Promise<PendingInvitation> {
    const email = input.email;
    const token = generateSecureToken();
    const now = new Date();

    const { invitation, inviter, tableName } = await this.prisma.$transaction(
      async (tx) => {
        await requireTableRole(tx, userId, tableId, 'ADMIN');
        // Serializes invitations to this table, so the limits below hold.
        const [table] = await tx.$queryRaw<{ name: string }[]>`
          SELECT name FROM inventory_tables WHERE id = ${tableId}::uuid FOR UPDATE`;
        const inviter = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { email: true, demoExpiresAt: true },
        });
        // The demo is public: it must never send email to arbitrary addresses.
        if (inviter.demoExpiresAt) {
          throw new ForbiddenException('Demo accounts cannot invite people');
        }

        const invitee = await tx.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (invitee && (await tableRole(tx, invitee.id, tableId))) {
          throw new ConflictException('Already has access');
        }

        const hourAgo = new Date(now.getTime() - ONE_HOUR_MS);
        const [toRecipient, fromSender] = await Promise.all([
          tx.invitation.count({ where: { email, createdAt: { gt: hourAgo } } }),
          tx.invitation.count({
            where: { invitedById: userId, createdAt: { gt: hourAgo } },
          }),
        ]);
        if (
          toRecipient >= EMAILS_PER_RECIPIENT_PER_HOUR ||
          fromSender >= INVITATIONS_PER_SENDER_PER_HOUR
        ) {
          throw new HttpException(
            'Too many invitations, try again later',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        // A new invitation to the same address replaces the pending one.
        await tx.invitation.updateMany({
          where: { tableId, email, ...pending(now) },
          data: { revokedAt: now },
        });
        const [shares, invitations] = await Promise.all([
          tx.tableShare.count({ where: { tableId } }),
          tx.invitation.count({ where: { tableId, ...pending(now) } }),
        ]);
        if (
          invitations >= MAX_PENDING_INVITATIONS_PER_TABLE ||
          shares + invitations >= MAX_PEOPLE_PER_TABLE
        ) {
          throw new UnprocessableEntityException('Sharing limit reached');
        }

        const invitation = await tx.invitation.create({
          data: {
            tableId,
            email,
            role: input.role,
            tokenHash: hashToken(token),
            invitedById: userId,
            expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
          },
        });
        return { invitation, inviter: inviter.email, tableName: table.name };
      },
    );

    await this.sendInvitation(email, {
      inviter,
      tableName,
      role: input.role,
      url: `${this.appUrl}/invitations?token=${encodeURIComponent(token)}`,
      days: INVITATION_TTL_DAYS,
    });
    return toPendingInvitation(invitation);
  }

  async revokeInvitation(
    userId: string,
    tableId: string,
    invitationId: string,
  ): Promise<void> {
    await requireTableRole(this.prisma, userId, tableId, 'ADMIN');
    const { count } = await this.prisma.invitation.updateMany({
      where: { id: invitationId, tableId, ...pending() },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      throw new NotFoundException('Invitation not found');
    }
  }

  async updateShare(
    userId: string,
    tableId: string,
    memberId: string,
    role: ShareRole,
  ): Promise<TableShareMember> {
    await requireTableRole(this.prisma, userId, tableId, 'ADMIN');
    const { count } = await this.prisma.tableShare.updateMany({
      where: { tableId, userId: memberId },
      data: { role },
    });
    if (count === 0) {
      throw new NotFoundException('Share not found');
    }
    const share = await this.prisma.tableShare.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: memberId } },
      include: { user: { select: { email: true } } },
    });
    return {
      userId: share.userId,
      email: share.user.email,
      role: share.role as ShareRole,
      createdAt: share.createdAt.toISOString(),
    };
  }

  /** Admins remove anyone's share; anyone can leave a table shared with them. */
  async removeShare(
    userId: string,
    tableId: string,
    memberId: string,
  ): Promise<void> {
    if (memberId !== userId) {
      await requireTableRole(this.prisma, userId, tableId, 'ADMIN');
    }
    const { count } = await this.prisma.tableShare.deleteMany({
      where: { tableId, userId: memberId },
    });
    if (count === 0) {
      throw new NotFoundException('Share not found');
    }
  }

  async preview(userId: string, token: string): Promise<InvitationPreview> {
    const invitation = await this.findUsable(token);
    // Only the address it was sent to may see what the invitation is for.
    await this.requireRecipient(userId, invitation);
    const details = await this.prisma.invitation.findUniqueOrThrow({
      where: { id: invitation.id },
      select: {
        table: { select: { name: true } },
        invitedBy: { select: { email: true } },
      },
    });
    return {
      tableName: details.table.name,
      invitedBy: details.invitedBy?.email ?? null,
      role: invitation.role as ShareRole,
      email: invitation.email,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async accept(userId: string, token: string): Promise<AcceptedInvitation> {
    const invitation = await this.findUsable(token);
    await this.requireRecipient(userId, invitation);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Conditional update: two concurrent requests cannot both use the token.
      const { count } = await tx.invitation.updateMany({
        where: { id: invitation.id, ...pending(now) },
        data: { acceptedAt: now },
      });
      if (count === 0) {
        throw invitationNotFound();
      }
      const current = await tableRole(tx, userId, invitation.tableId);
      // Accepting never lowers access the user already has.
      if (!current || ROLE_RANK[current] < ROLE_RANK[invitation.role]) {
        await tx.tableShare.upsert({
          where: { tableId_userId: { tableId: invitation.tableId, userId } },
          create: {
            tableId: invitation.tableId,
            userId,
            role: invitation.role,
          },
          update: { role: invitation.role },
        });
      }
    });
    return { tableId: invitation.tableId };
  }

  private async findUsable(token: string): Promise<Invitation> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw invitationNotFound();
    }
    return invitation;
  }

  private async requireRecipient(
    userId: string,
    invitation: Invitation,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    if (user.email !== invitation.email) {
      throw new ForbiddenException('This invitation is for another account');
    }
  }

  /**
   * Delivery failures are logged, not returned: the invitation exists and the
   * admin can send it again. Demo addresses (.invalid) never receive email.
   */
  private async sendInvitation(
    to: string,
    details: Parameters<typeof invitationEmail>[0],
  ): Promise<void> {
    if (to.endsWith('.invalid')) {
      return;
    }
    try {
      await this.mailer.send({ to, ...invitationEmail(details) });
    } catch (error) {
      this.logger.error(
        'Failed to send an invitation email',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

function invitationNotFound() {
  return new NotFoundException('Invitation not found or expired');
}
