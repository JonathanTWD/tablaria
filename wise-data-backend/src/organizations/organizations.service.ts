import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  MAX_MEMBERS_PER_ORGANIZATION,
  MAX_ORGANIZATIONS_PER_USER,
  MAX_PENDING_INVITATIONS_PER_ORGANIZATION,
  type OrganizationDetail,
  type OrganizationMember,
  type OrganizationSummary,
  type organizationInputSchema,
  type organizationInviteSchema,
  type PendingInvitation,
} from '@wisedata/shared';
import type { z } from 'zod';
import { generateSecureToken, hashToken } from '../auth/secure-token';
import { auditPermission } from '../common/permission-audit';
import { PrismaService } from '../database/prisma.service';
import type {
  Membership,
  Organization,
  Prisma,
  Role,
} from '../generated/prisma/client';
import { RealtimeService } from '../realtime/realtime.service';
import {
  checkInvitationAllowed,
  INVITATION_TTL_MS,
  InvitationSender,
  pending,
  toPendingInvitation,
} from '../sharing/invitations';
import { personalOrganizationId, ROLE_RANK } from '../tables/table-access';
import {
  lockOrganization,
  requireOrganizationRole,
  requireSharedOrganizationRole,
} from './organization-access';

type OrganizationInput = z.output<typeof organizationInputSchema>;
type OrganizationInvite = z.output<typeof organizationInviteSchema>;

const WITH_COUNTS = {
  _count: { select: { memberships: true, tables: true } },
} as const;

type OrganizationWithCounts = Organization & {
  _count: { memberships: number; tables: number };
};

/**
 * Organizations: shared spaces whose tables all members see, with the access
 * their role gives (ADR-019). Each user also has a personal one, theirs alone.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly sender: InvitationSender,
  ) {}

  /** The personal space first, then the organizations by name. */
  async list(userId: string): Promise<OrganizationSummary[]> {
    await personalOrganizationId(this.prisma, userId);
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { organization: { include: WITH_COUNTS } },
    });
    return memberships
      .map((membership) => toSummary(membership.organization, membership.role))
      .sort(
        (a, b) =>
          Number(b.personal) - Number(a.personal) ||
          a.name.localeCompare(b.name, 'es'),
      );
  }

  async get(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationDetail> {
    const { role } = await requireOrganizationRole(
      this.prisma,
      userId,
      organizationId,
      'VIEWER',
    );
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: {
        ...WITH_COUNTS,
        memberships: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { email: true } } },
        },
      },
    });
    const canManage = ROLE_RANK[role] >= ROLE_RANK.ADMIN;
    const invitations = canManage
      ? await this.prisma.invitation.findMany({
          where: { organizationId, ...pending() },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    return {
      ...toSummary(organization, role),
      members: organization.memberships.map(toMember),
      invitations: invitations.map(toPendingInvitation),
    };
  }

  async create(
    userId: string,
    input: OrganizationInput,
  ): Promise<OrganizationDetail> {
    const organization = await this.prisma.$transaction(async (tx) => {
      // Serializes this user's creates and joins, so the limit holds.
      await tx.$executeRaw`SELECT 1 FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const count = await tx.membership.count({
        where: { userId, organization: { personalForId: null } },
      });
      if (count >= MAX_ORGANIZATIONS_PER_USER) {
        throw new UnprocessableEntityException('Organization limit reached');
      }
      return tx.organization.create({
        data: {
          name: input.name,
          memberships: { create: { userId, role: 'OWNER' } },
        },
      });
    });
    return this.get(userId, organization.id);
  }

  async rename(
    userId: string,
    organizationId: string,
    input: OrganizationInput,
  ): Promise<OrganizationDetail> {
    await requireSharedOrganizationRole(
      this.prisma,
      userId,
      organizationId,
      'ADMIN',
    );
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { name: input.name },
    });
    return this.get(userId, organizationId);
  }

  /** Owners only: its tables, records and memberships go with it. */
  async remove(userId: string, organizationId: string): Promise<void> {
    const tableIds = await this.prisma.$transaction(async (tx) => {
      await requireSharedOrganizationRole(tx, userId, organizationId, 'OWNER');
      const tables = await tx.inventoryTable.findMany({
        where: { organizationId },
        select: { id: true },
      });
      await tx.organization.delete({ where: { id: organizationId } });
      return tables.map((table) => table.id);
    });
    auditPermission('organization.delete', {
      organization: organizationId,
      tables: String(tableIds.length),
      by: userId,
    });
    for (const tableId of tableIds) {
      this.realtime.publish(tableId, 'deleted');
    }
  }

  /**
   * Admins manage members; only owners grant, change or take away ownership,
   * and there is always at least one owner.
   */
  async updateMember(
    userId: string,
    organizationId: string,
    memberId: string,
    role: Role,
  ): Promise<OrganizationMember> {
    const member = await this.prisma.$transaction(async (tx) => {
      // Locked first, so the roles read below can't change before the write.
      await lockOrganization(tx, organizationId);
      const actorRole = await requireSharedOrganizationRole(
        tx,
        userId,
        organizationId,
        'ADMIN',
      );
      const member = await findMember(tx, organizationId, memberId);
      if (
        (member.role === 'OWNER' || role === 'OWNER') &&
        actorRole !== 'OWNER'
      ) {
        throw new ForbiddenException('Only owners can change ownership');
      }
      if (member.role === 'OWNER' && role !== 'OWNER') {
        await requireAnotherOwner(tx, organizationId);
      }
      return tx.membership.update({
        where: { organizationId_userId: { organizationId, userId: memberId } },
        data: { role },
        include: { user: { select: { email: true } } },
      });
    });
    auditPermission('organization.member.update', {
      organization: organizationId,
      user: memberId,
      role,
      by: userId,
    });
    // Open tables refetch themselves and pick up the member's new role.
    for (const tableId of await this.tableIds(organizationId)) {
      this.realtime.publish(tableId, 'table');
    }
    return toMember(member);
  }

  /** Admins remove members (owners only by owners); anyone can leave. */
  async removeMember(
    userId: string,
    organizationId: string,
    memberId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockOrganization(tx, organizationId);
      const leaving = memberId === userId;
      const actorRole = await requireSharedOrganizationRole(
        tx,
        userId,
        organizationId,
        leaving ? 'VIEWER' : 'ADMIN',
      );
      const member = await findMember(tx, organizationId, memberId);
      if (member.role === 'OWNER') {
        if (!leaving && actorRole !== 'OWNER') {
          throw new ForbiddenException('Only owners can remove owners');
        }
        await requireAnotherOwner(tx, organizationId);
      }
      await tx.membership.delete({
        where: { organizationId_userId: { organizationId, userId: memberId } },
      });
    });
    auditPermission('organization.member.remove', {
      organization: organizationId,
      user: memberId,
      by: userId,
    });
    // Tables shared with them directly stay open; the rest close for them.
    const tables = await this.prisma.inventoryTable.findMany({
      where: { organizationId, shares: { none: { userId: memberId } } },
      select: { id: true },
    });
    for (const table of tables) {
      this.realtime.revoke(table.id, memberId);
    }
  }

  async invite(
    userId: string,
    organizationId: string,
    input: OrganizationInvite,
  ): Promise<PendingInvitation> {
    const email = input.email;
    const token = generateSecureToken();
    const now = new Date();

    const { invitation, inviter, organizationName } =
      await this.prisma.$transaction(async (tx) => {
        await requireSharedOrganizationRole(
          tx,
          userId,
          organizationId,
          'ADMIN',
        );
        // Serializes invitations to this organization, so the limits hold.
        const [organization] = await tx.$queryRaw<{ name: string }[]>`
          SELECT name FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
        const inviter = await checkInvitationAllowed(tx, userId, email, now);

        const alreadyMember = await tx.membership.count({
          where: { organizationId, user: { email } },
        });
        if (alreadyMember > 0) {
          throw new ConflictException('Already a member');
        }

        // A new invitation to the same address replaces the pending one.
        await tx.invitation.updateMany({
          where: { organizationId, email, ...pending(now) },
          data: { revokedAt: now },
        });
        const [members, invitations] = await Promise.all([
          tx.membership.count({ where: { organizationId } }),
          tx.invitation.count({ where: { organizationId, ...pending(now) } }),
        ]);
        if (
          invitations >= MAX_PENDING_INVITATIONS_PER_ORGANIZATION ||
          members + invitations >= MAX_MEMBERS_PER_ORGANIZATION
        ) {
          throw new UnprocessableEntityException('Member limit reached');
        }

        const invitation = await tx.invitation.create({
          data: {
            organizationId,
            email,
            role: input.role,
            tokenHash: hashToken(token),
            invitedById: userId,
            expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
          },
        });
        return { invitation, inviter, organizationName: organization.name };
      });

    await this.sender.send(email, token, {
      inviter,
      target: {
        type: 'organization',
        name: organizationName,
        role: input.role,
      },
    });
    auditPermission('organization.invite', {
      invitation: invitation.id,
      organization: organizationId,
      role: input.role,
      by: userId,
    });
    return toPendingInvitation(invitation);
  }

  async revokeInvitation(
    userId: string,
    organizationId: string,
    invitationId: string,
  ): Promise<void> {
    await requireSharedOrganizationRole(
      this.prisma,
      userId,
      organizationId,
      'ADMIN',
    );
    const { count } = await this.prisma.invitation.updateMany({
      where: { id: invitationId, organizationId, ...pending() },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      throw new NotFoundException('Invitation not found');
    }
    auditPermission('organization.invitation.revoke', {
      invitation: invitationId,
      organization: organizationId,
      by: userId,
    });
  }

  private async tableIds(organizationId: string): Promise<string[]> {
    const tables = await this.prisma.inventoryTable.findMany({
      where: { organizationId },
      select: { id: true },
    });
    return tables.map((table) => table.id);
  }
}

async function findMember(
  tx: Prisma.TransactionClient,
  organizationId: string,
  memberId: string,
): Promise<Membership> {
  const member = await tx.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId: memberId } },
  });
  if (!member) {
    throw new NotFoundException('Member not found');
  }
  return member;
}

/** Call with the organization locked, so two owners cannot both step down. */
async function requireAnotherOwner(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<void> {
  const owners = await tx.membership.count({
    where: { organizationId, role: 'OWNER' },
  });
  if (owners <= 1) {
    throw new ConflictException('An organization needs at least one owner');
  }
}

function toSummary(
  organization: OrganizationWithCounts,
  role: Role,
): OrganizationSummary {
  return {
    role,
    id: organization.id,
    name: organization.name,
    personal: organization.personalForId !== null,
    memberCount: organization._count.memberships,
    tableCount: organization._count.tables,
    createdAt: organization.createdAt.toISOString(),
  };
}

function toMember(
  membership: Membership & { user: { email: string } },
): OrganizationMember {
  return {
    userId: membership.userId,
    email: membership.user.email,
    role: membership.role,
    createdAt: membership.createdAt.toISOString(),
  };
}
