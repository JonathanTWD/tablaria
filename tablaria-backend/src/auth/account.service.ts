import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  AccountExport,
  CellValue,
  ChangePasswordInput,
} from '@tablaria/shared';
import { toTableColumn } from '../columns/column-mapper';
import { auditPermission } from '../common/permission-audit';
import { PrismaService } from '../database/prisma.service';
import type { User } from '../generated/prisma/client';
import { lockOrganization } from '../organizations/organization-access';
import { RealtimeService } from '../realtime/realtime.service';
import { personalOrganizationId } from '../tables/table-access';
import { PasswordService } from './password.service';
import { SessionService, type SessionTokens } from './session.service';

/** The signed-in user's own account: password, sessions, data and deletion. */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Ends every other session; this browser gets a fresh one. */
  async changePassword(
    userId: string,
    { currentPassword, newPassword }: ChangePasswordInput,
  ): Promise<SessionTokens> {
    await this.requirePassword(userId, currentPassword);
    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      revokeSessions(this.prisma, userId),
    ]);
    this.realtime.disconnectUser(userId);
    return this.sessions.start(userId);
  }

  /**
   * Revokes every refresh token. Access tokens already issued stay valid until
   * they expire (15 minutes): they are stateless by design (ADR-008).
   */
  async logoutEverywhere(userId: string): Promise<void> {
    await revokeSessions(this.prisma, userId);
    this.realtime.disconnectUser(userId);
  }

  /** The user's data in a portable format (RGPD art. 20). */
  async export(userId: string): Promise<AccountExport> {
    const user = await this.requireRealAccount(userId);
    const personalId = await personalOrganizationId(this.prisma, userId);
    const [memberships, shares, tables] = await Promise.all([
      this.prisma.membership.findMany({
        where: { userId, organization: { personalForId: null } },
        select: { role: true, organization: { select: { name: true } } },
      }),
      this.prisma.tableShare.findMany({
        where: { userId },
        select: { role: true, table: { select: { name: true } } },
      }),
      this.prisma.inventoryTable.findMany({
        where: { organizationId: personalId },
        orderBy: { createdAt: 'asc' },
        include: {
          columns: { orderBy: { position: 'asc' } },
          records: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      account: { email: user.email, createdAt: user.createdAt.toISOString() },
      organizations: memberships.map(({ role, organization }) => ({
        name: organization.name,
        role,
      })),
      sharedWithMe: shares.map(({ role, table }) => ({
        table: table.name,
        role,
      })),
      tables: tables.map((table) => {
        const columns = table.columns.map(toTableColumn);
        return {
          name: table.name,
          description: table.description,
          columns: columns.map(({ name, type, required }) => ({
            name,
            type,
            required,
          })),
          // Keyed by column name: ids mean nothing outside Tablaria.
          records: table.records.map((record) => {
            const data = record.data as Record<string, CellValue>;
            return Object.fromEntries(
              columns.map((column) => [column.name, data[column.id] ?? null]),
            );
          }),
        };
      }),
    };
  }

  /**
   * Deletes the account with its personal space, and the organizations where
   * the user is the only member. Refused while they are the only owner of an
   * organization others still use: ownership must be handed over first.
   */
  async delete(userId: string, password: string): Promise<void> {
    const { email } = await this.requirePassword(userId, password);
    const deletedTables = await this.prisma.$transaction(async (tx) => {
      const owned = await tx.membership.findMany({
        where: { userId, role: 'OWNER', organization: { personalForId: null } },
        select: { organizationId: true },
      });
      const alone: string[] = [];
      const blocking: { id: string; name: string }[] = [];
      for (const { organizationId } of owned) {
        // Locked: nobody can leave or be demoted while this decides.
        await lockOrganization(tx, organizationId);
        const organization = await tx.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: {
            name: true,
            memberships: { select: { userId: true, role: true } },
          },
        });
        const others = organization.memberships.filter(
          (member) => member.userId !== userId,
        );
        if (others.length === 0) {
          alone.push(organizationId);
        } else if (!others.some(({ role }) => role === 'OWNER')) {
          blocking.push({ id: organizationId, name: organization.name });
        }
      }
      if (blocking.length > 0) {
        throw new ConflictException({
          message: 'Hand over ownership of these organizations first',
          details: blocking.map(({ id, name }) => ({
            path: id,
            message: name,
          })),
        });
      }

      const personalId = await personalOrganizationId(tx, userId);
      const tables = await tx.inventoryTable.findMany({
        where: { organizationId: { in: [personalId, ...alone] } },
        select: { id: true },
      });
      await tx.organization.deleteMany({ where: { id: { in: alone } } });
      // Invitations to their address would keep it after the account is gone.
      await tx.invitation.deleteMany({ where: { email } });
      // The personal space, memberships, shares and sessions go with the user.
      await tx.user.delete({ where: { id: userId } });
      return tables.map(({ id }) => id);
    });

    auditPermission('account.delete', {
      user: userId,
      tables: String(deletedTables.length),
    });
    for (const tableId of deletedTables) {
      this.realtime.publish(tableId, 'deleted');
    }
    this.realtime.disconnectUser(userId);
  }

  /** Demo accounts have no password to check, and are deleted on their own. */
  private async requireRealAccount(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.demoExpiresAt) {
      throw new ForbiddenException('Not available in the demo');
    }
    return user;
  }

  private async requirePassword(
    userId: string,
    password: string,
  ): Promise<User> {
    const user = await this.requireRealAccount(userId);
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      // Not 401: the session is fine, only the password is wrong.
      throw new UnprocessableEntityException('Wrong password');
    }
    return user;
  }
}

function revokeSessions(prisma: PrismaService, userId: string) {
  return prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
