import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma, Role } from '../generated/prisma/client';

type Db = Prisma.TransactionClient;

export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

/**
 * Tables a user can open: those of organizations they belong to, and those
 * shared with them directly. The only definition of "accessible" in the API.
 */
export function accessibleTables(
  userId: string,
): Prisma.InventoryTableWhereInput {
  return {
    OR: [
      { organization: { memberships: { some: { userId } } } },
      { shares: { some: { userId } } },
    ],
  };
}

/**
 * The user's role in a table: the higher of their role in its organization and
 * a direct share. Null when they have no access at all.
 */
export async function tableRole(
  db: Db,
  userId: string,
  tableId: string,
): Promise<Role | null> {
  const table = await db.inventoryTable.findUnique({
    where: { id: tableId },
    select: {
      organization: {
        select: { memberships: { where: { userId }, select: { role: true } } },
      },
      shares: { where: { userId }, select: { role: true } },
    },
  });
  const roles = [
    ...(table?.organization.memberships ?? []),
    ...(table?.shares ?? []),
  ].map(({ role }) => role);
  return roles.reduce<Role | null>(
    (best, role) => (best && ROLE_RANK[best] >= ROLE_RANK[role] ? best : role),
    null,
  );
}

/**
 * Throws unless the user has at least `minimum` in the table. Without any
 * access the table answers 404, exactly like a missing one, so ids of other
 * people's tables reveal nothing; with too low a role it answers 403.
 */
export async function requireTableRole(
  db: Db,
  userId: string,
  tableId: string,
  minimum: Role,
): Promise<Role> {
  const role = await tableRole(db, userId, tableId);
  if (!role) {
    throw new NotFoundException('Table not found');
  }
  if (ROLE_RANK[role] < ROLE_RANK[minimum]) {
    throw new ForbiddenException('Not allowed in this table');
  }
  return role;
}

/**
 * Checks the role, then marks the table as edited now. As a side effect of the
 * update its row stays locked until the transaction ends, so changes to its
 * columns never interleave.
 */
export async function touchTable(
  tx: Db,
  userId: string,
  tableId: string,
  minimum: Role,
): Promise<void> {
  await requireTableRole(tx, userId, tableId, minimum);
  await tx.inventoryTable.update({
    where: { id: tableId },
    data: { updatedAt: new Date() },
  });
}

/** The user's personal organization, created on first use. */
export async function personalOrganizationId(
  db: Db,
  userId: string,
): Promise<string> {
  // A plain read in the usual case; the upsert only runs for a new account.
  const existing = await db.organization.findUnique({
    where: { personalForId: userId },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }
  const organization = await db.organization.upsert({
    where: { personalForId: userId },
    update: {},
    create: {
      name: 'Personal',
      personalForId: userId,
      memberships: { create: { userId, role: 'OWNER' } },
    },
    select: { id: true },
  });
  return organization.id;
}
