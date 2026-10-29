import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type AcceptedInvitation,
  type InvitationPreview,
  type InvitationTarget,
  MAX_ORGANIZATIONS_PER_USER,
  type InviteInput,
  MAX_PEOPLE_PER_TABLE,
  MAX_PENDING_INVITATIONS_PER_TABLE,
  type PendingInvitation,
  type ShareRole,
  type TableShareMember,
  type TableSharing,
} from '@wisedata/shared';
import { generateSecureToken, hashToken } from '../auth/secure-token';
import { PrismaService } from '../database/prisma.service';
import type { Invitation, Prisma } from '../generated/prisma/client';
import { RealtimeService } from '../realtime/realtime.service';
import { requireTableRole, ROLE_RANK, tableRole } from '../tables/table-access';
import {
  checkInvitationAllowed,
  INVITATION_TTL_MS,
  InvitationSender,
  pending,
  toPendingInvitation,
} from './invitations';

/** Sharing single tables by email, and accepting any invitation (ADR-019). */
@Injectable()
export class SharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly sender: InvitationSender,
  ) {}

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
        const inviter = await checkInvitationAllowed(tx, userId, email, now);

        const invitee = await tx.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (invitee && (await tableRole(tx, invitee.id, tableId))) {
          throw new ConflictException('Already has access');
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
        return { invitation, inviter, tableName: table.name };
      },
    );

    await this.sender.send(email, token, {
      inviter,
      target: { type: 'table', name: tableName, role: input.role },
    });
    this.realtime.publish(tableId, 'sharing');
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
    this.realtime.publish(tableId, 'sharing');
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
    // "table": the member's open page refetches it and gets their new role.
    this.realtime.publish(tableId, 'table');
    this.realtime.publish(tableId, 'sharing');
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
    this.realtime.revoke(tableId, memberId);
    this.realtime.publish(tableId, 'sharing');
  }

  async preview(userId: string, token: string): Promise<InvitationPreview> {
    const invitation = await this.findUsable(token);
    // Only the address it was sent to may see what the invitation is for.
    await this.requireRecipient(userId, invitation);
    const details = await this.prisma.invitation.findUniqueOrThrow({
      where: { id: invitation.id },
      select: {
        table: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        invitedBy: { select: { email: true } },
      },
    });
    return {
      target: invitationTarget(details),
      invitedBy: details.invitedBy?.email ?? null,
      role: invitation.role,
      email: invitation.email,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async accept(userId: string, token: string): Promise<AcceptedInvitation> {
    const invitation = await this.findUsable(token);
    await this.requireRecipient(userId, invitation);
    const now = new Date();

    const target = await this.prisma.$transaction(async (tx) => {
      // Conditional update: two concurrent requests cannot both use the token.
      const { count } = await tx.invitation.updateMany({
        where: { id: invitation.id, ...pending(now) },
        data: { acceptedAt: now },
      });
      if (count === 0) {
        throw invitationNotFound();
      }
      const details = await tx.invitation.findUniqueOrThrow({
        where: { id: invitation.id },
        select: {
          table: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true } },
        },
      });
      const target = invitationTarget(details);
      if (target.type === 'table') {
        await joinTable(tx, userId, target.id, invitation.role);
      } else {
        await joinOrganization(tx, userId, target.id, invitation.role);
      }
      return target;
    });
    if (target.type === 'table') {
      this.realtime.publish(target.id, 'sharing');
    }
    return { target };
  }

  /** A pending invitation whose table or organization still exists. */
  private async findUsable(token: string): Promise<Invitation> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (
      !invitation ||
      (!invitation.tableId && !invitation.organizationId) ||
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
}

type Named = { id: string; name: string } | null;

/** Its table or organization; deleted targets make the invitation unusable. */
function invitationTarget(details: {
  table: Named;
  organization: Named;
}): InvitationTarget {
  if (details.table) {
    return { type: 'table', ...details.table };
  }
  if (details.organization) {
    return { type: 'organization', ...details.organization };
  }
  throw invitationNotFound();
}

/** Accepting never lowers access the user already has. */
async function joinTable(
  tx: Prisma.TransactionClient,
  userId: string,
  tableId: string,
  role: Invitation['role'],
): Promise<void> {
  const current = await tableRole(tx, userId, tableId);
  if (!current || ROLE_RANK[current] < ROLE_RANK[role]) {
    await tx.tableShare.upsert({
      where: { tableId_userId: { tableId, userId } },
      create: { tableId, userId, role },
      update: { role },
    });
  }
}

async function joinOrganization(
  tx: Prisma.TransactionClient,
  userId: string,
  organizationId: string,
  role: Invitation['role'],
): Promise<void> {
  const current = await tx.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  });
  if (current) {
    if (ROLE_RANK[current.role] < ROLE_RANK[role]) {
      await tx.membership.update({
        where: { organizationId_userId: { organizationId, userId } },
        data: { role },
      });
    }
    return;
  }
  // Same lock as creating an organization, so the limit holds.
  await tx.$executeRaw`SELECT 1 FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
  const organizations = await tx.membership.count({
    where: { userId, organization: { personalForId: null } },
  });
  if (organizations >= MAX_ORGANIZATIONS_PER_USER) {
    throw new UnprocessableEntityException('Organization limit reached');
  }
  await tx.membership.create({ data: { organizationId, userId, role } });
}

function invitationNotFound() {
  return new NotFoundException('Invitation not found or expired');
}
