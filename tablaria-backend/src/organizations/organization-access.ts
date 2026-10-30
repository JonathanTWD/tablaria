import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma, Role } from '../generated/prisma/client';
import { ROLE_RANK } from '../tables/table-access';

type Db = Prisma.TransactionClient;

export interface OrganizationAccess {
  role: Role;
  personal: boolean;
}

/**
 * Throws unless the user belongs to the organization with at least `minimum`.
 * Non-members get 404, like for tables, so ids of other organizations reveal
 * nothing; members with too low a role get 403.
 */
export async function requireOrganizationRole(
  db: Db,
  userId: string,
  organizationId: string,
  minimum: Role,
): Promise<OrganizationAccess> {
  const membership = await db.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true, organization: { select: { personalForId: true } } },
  });
  if (!membership) {
    throw new NotFoundException('Organization not found');
  }
  if (ROLE_RANK[membership.role] < ROLE_RANK[minimum]) {
    throw new ForbiddenException('Not allowed in this organization');
  }
  return {
    role: membership.role,
    personal: membership.organization.personalForId !== null,
  };
}

/** Like requireOrganizationRole, for what only shared organizations allow. */
export async function requireSharedOrganizationRole(
  db: Db,
  userId: string,
  organizationId: string,
  minimum: Role,
): Promise<Role> {
  const access = await requireOrganizationRole(
    db,
    userId,
    organizationId,
    minimum,
  );
  if (access.personal) {
    throw new ForbiddenException('The personal space cannot be changed');
  }
  return access.role;
}

/** Locks the organization row: membership changes and limits never interleave. */
export async function lockOrganization(
  tx: Db,
  organizationId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT 1 FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
}
