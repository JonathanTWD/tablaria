import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  type ColumnDefinition,
  columnDefinitionSchema,
  recordDataSchema,
  TABLE_TEMPLATES,
} from '@wisedata/shared';
import { randomUUID } from 'node:crypto';
import { ACCESS_TOKEN_TTL_SECONDS } from '../auth/auth.constants';
import { PasswordService } from '../auth/password.service';
import { generateSecureToken } from '../auth/secure-token';
import { toColumnData } from '../columns/column-mapper';
import { PrismaService } from '../database/prisma.service';
import { withoutEmptyCells } from '../records/record-data';
import type { Prisma, User } from '../generated/prisma/client';
import { DEMO_TABLES, type DemoTable } from './demo-data';

export const DEMO_TTL_MS = 24 * 60 * 60 * 1000;
/** Keeps the free database small even if many people try the demo at once. */
export const MAX_ACTIVE_DEMO_ACCOUNTS = 300;

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

    const active = await this.prisma.user.count({
      where: { demoExpiresAt: { not: null } },
    });
    if (active >= MAX_ACTIVE_DEMO_ACCOUNTS) {
      throw new ServiceUnavailableException(
        'The demo is busy, try again later',
      );
    }

    // Nobody knows this password: the account is reachable only through its session.
    const passwordHash = await this.passwords.hash(generateSecureToken());
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          // .invalid is reserved (RFC 2606), so no real mailbox can ever match it.
          email: `demo-${randomUUID()}@demo.invalid`,
          passwordHash,
          emailVerifiedAt: now,
          demoExpiresAt: new Date(now.getTime() + DEMO_TTL_MS),
        },
      });
      // Lists show the most recently edited table first, so create the first one last.
      for (const table of [...DEMO_TABLES].reverse()) {
        await createDemoTable(tx, user.id, table);
      }
      return user;
    });
  }

  deleteExpiredAccounts(): Promise<Prisma.BatchPayload> {
    // Waiting one access-token lifetime past expiry means no request can still
    // carry a valid token for the account (refresh stops at expiry), so writes
    // never hit a missing owner. Tables, columns, records and tokens go with
    // the user (ON DELETE CASCADE).
    const deletableBefore = new Date(
      Date.now() - ACCESS_TOKEN_TTL_SECONDS * 1000,
    );
    return this.prisma.user.deleteMany({
      where: { demoExpiresAt: { lt: deletableBefore } },
    });
  }
}

async function createDemoTable(
  tx: Prisma.TransactionClient,
  ownerId: string,
  table: DemoTable,
): Promise<void> {
  const definitions: ColumnDefinition[] = TABLE_TEMPLATES[table.templateId].map(
    (column) => columnDefinitionSchema.parse(column),
  );
  const created = await tx.inventoryTable.create({
    data: {
      ownerId,
      name: table.name,
      description: table.description,
      columns: {
        create: definitions.map((column, position) => ({
          ...toColumnData(column),
          position,
        })),
      },
    },
    include: { columns: true },
  });

  const columns = definitions.map((definition) => {
    const id = created.columns.find(({ name }) => name === definition.name)?.id;
    if (!id) {
      throw new Error(`Demo column "${definition.name}" was not created`);
    }
    return { ...definition, id };
  });
  // The same validation as the API, so the demo data can never drift from the rules.
  const schema = recordDataSchema(columns, { partial: false });

  await tx.record.createMany({
    data: table.rows.map((row) => {
      const byId = Object.fromEntries(
        columns.map(({ id, name }) => [id, row[name]]),
      );
      return {
        tableId: created.id,
        data: withoutEmptyCells(schema.parse(byId)),
      };
    }),
  });
}
