import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ACCESS_TOKEN_TTL_SECONDS } from '../auth/auth.constants';
import { PasswordService } from '../auth/password.service';
import { generateSecureToken } from '../auth/secure-token';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, User } from '../generated/prisma/client';
import { personalOrganizationId } from '../tables/table-access';
import { DEMO_ORGANIZATION, demoTables, type DemoTableKey } from './demo-data';
import { createDemoTables } from './demo-tables';

export const DEMO_TTL_MS = 24 * 60 * 60 * 1000;
/** Keeps the free database small even if many people try the demo at once. */
export const MAX_ACTIVE_DEMO_ACCOUNTS = 300;
const VISITOR_EMAIL_PREFIX = 'demo-';
/** How the visitor's lists show the demo tables: the shop's catalog first. */
export const DEMO_DISPLAY_ORDER: DemoTableKey[] = [
  'products',
  'orders',
  'suppliers',
  'equipment',
  'warehouse',
];

/**
 * Temporary accounts for "Try the demo": already verified, filled with example
 * tables, and deleted with all their data after DEMO_TTL_MS.
 */
@Injectable()
export class DemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async createAccount(): Promise<User> {
    // Cleaning up here needs no scheduler, which a free host would put to sleep anyway.
    await this.deleteExpiredAccounts();

    // Visitors only, not the fictitious members of their example organizations.
    const active = await this.prisma.user.count({
      where: {
        demoExpiresAt: { not: null },
        email: { startsWith: VISITOR_EMAIL_PREFIX },
      },
    });
    if (active >= MAX_ACTIVE_DEMO_ACCOUNTS) {
      throw new ServiceUnavailableException(
        'The demo is busy, try again later',
      );
    }

    // Nobody knows this password: the account is reachable only through its session.
    const passwordHash = await this.passwords.hash(generateSecureToken());
    const now = new Date();

    const demoExpiresAt = new Date(now.getTime() + DEMO_TTL_MS);
    const suffix = randomUUID().slice(0, 8);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          // .invalid is reserved (RFC 2606), so no real mailbox can ever match it.
          email: `${VISITOR_EMAIL_PREFIX}${randomUUID()}@demo.invalid`,
          passwordHash,
          emailVerifiedAt: now,
          demoExpiresAt,
        },
      });
      const personalId = await personalOrganizationId(tx, user.id);
      // Expiring with the visitor, the fictitious members are deleted with them.
      const members = await tx.user.createManyAndReturn({
        data: DEMO_ORGANIZATION.members.map(({ name }) => ({
          email: `${name}.${suffix}@demo.invalid`,
          passwordHash,
          emailVerifiedAt: now,
          demoExpiresAt,
        })),
        select: { id: true },
      });
      const organization = await tx.organization.create({
        data: {
          name: DEMO_ORGANIZATION.name,
          memberships: {
            create: [
              { userId: user.id, role: 'OWNER' },
              ...members.map(({ id }, index) => ({
                userId: id,
                role: DEMO_ORGANIZATION.members[index].role,
              })),
            ],
          },
        },
      });
      await createDemoTables(tx, demoTables(now), DEMO_DISPLAY_ORDER, {
        personalId,
        organizationId: organization.id,
        visitorId: user.id,
        memberIds: new Map(
          members.map(({ id }, index) => [
            DEMO_ORGANIZATION.members[index].name,
            id,
          ]),
        ),
        now,
      });
      return user;
    });
  }

  async deleteExpiredAccounts(): Promise<Prisma.BatchPayload> {
    // Waiting one access-token lifetime past expiry means no request can still
    // carry a valid token for the account (refresh stops at expiry), so writes
    // never hit a missing owner. Tables, columns, records and tokens go with
    // the user (ON DELETE CASCADE).
    const deletableBefore = new Date(
      Date.now() - ACCESS_TOKEN_TTL_SECONDS * 1000,
    );
    const [deleted] = await this.prisma.$transaction([
      this.prisma.user.deleteMany({
        where: { demoExpiresAt: { lt: deletableBefore } },
      }),
      // Organizations a demo created are left without members: they go too.
      this.prisma.organization.deleteMany({
        where: { personalForId: null, memberships: { none: {} } },
      }),
    ]);
    return deleted;
  }
}
