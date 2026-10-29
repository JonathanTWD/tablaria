import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type ColumnDefinition,
  columnDefinitionSchema,
  type createTableSchema,
  MAX_TABLES_PER_SPACE,
  type SharedTableSummary,
  TABLE_TEMPLATES,
  type TableRole,
  type TableDetail,
  type TableSummary,
  type updateTableSchema,
} from '@wisedata/shared';
import type { z } from 'zod';
import { toColumnData, toTableColumn } from '../columns/column-mapper';
import { PrismaService } from '../database/prisma.service';
import type { InventoryTable, Prisma } from '../generated/prisma/client';
import {
  lockOrganization,
  requireOrganizationRole,
} from '../organizations/organization-access';
import { RealtimeService } from '../realtime/realtime.service';
import {
  accessibleTables,
  higherRole,
  personalOrganizationId,
  requireTableRole,
  tableRole,
} from './table-access';

type CreateTable = z.output<typeof createTableSchema>;
type UpdateTable = z.output<typeof updateTableSchema>;

const WITH_COUNTS = {
  _count: { select: { columns: true, records: true } },
} as const;

type TableWithCounts = InventoryTable & {
  _count: { columns: number; records: number };
};

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** The tables of the user's personal space. */
  async list(userId: string): Promise<TableSummary[]> {
    const organizationId = await personalOrganizationId(this.prisma, userId);
    const tables = await this.prisma.inventoryTable.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      include: WITH_COUNTS,
    });
    // The personal space belongs to its user alone.
    return tables.map((table) => toTableSummary(table, 'OWNER'));
  }

  /** The tables of an organization the user belongs to. */
  async listInOrganization(
    userId: string,
    organizationId: string,
  ): Promise<TableSummary[]> {
    const { role } = await requireOrganizationRole(
      this.prisma,
      userId,
      organizationId,
      'VIEWER',
    );
    const tables = await this.prisma.inventoryTable.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      include: {
        ...WITH_COUNTS,
        shares: { where: { userId }, select: { role: true } },
      },
    });
    // A direct share can raise a member's role in one table.
    return tables.map((table) =>
      toTableSummary(table, higherRole(role, table.shares[0]?.role)),
    );
  }

  /** Tables other people shared with the user directly, most recently edited first. */
  async listShared(userId: string): Promise<SharedTableSummary[]> {
    const tables = await this.prisma.inventoryTable.findMany({
      where: {
        shares: { some: { userId } },
        // Tables of the user's own organizations are listed with those.
        organization: { memberships: { none: { userId } } },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        ...WITH_COUNTS,
        shares: { where: { userId }, select: { role: true } },
        organization: {
          select: { name: true, personalFor: { select: { email: true } } },
        },
      },
    });
    return tables.map((table) => ({
      ...toTableSummary(table, table.shares[0].role),
      sharedBy:
        table.organization.personalFor?.email ?? table.organization.name,
    }));
  }

  async get(userId: string, tableId: string): Promise<TableDetail> {
    const table = await this.prisma.inventoryTable.findFirst({
      where: { id: tableId, ...accessibleTables(userId) },
      include: { ...WITH_COUNTS, columns: { orderBy: { position: 'asc' } } },
    });
    const role = table && (await tableRole(this.prisma, userId, tableId));
    if (!table || !role) {
      throw new NotFoundException('Table not found');
    }
    const membership = await this.prisma.membership.findUnique({
      where: {
        organizationId_userId: { organizationId: table.organizationId, userId },
      },
      select: { role: true },
    });
    return {
      ...toTableSummary(table, role),
      organizationId: table.organizationId,
      member: membership !== null,
      columns: table.columns.map(toTableColumn),
    };
  }

  /** Creates the table in the personal space, or in an organization it administers. */
  async create(
    userId: string,
    input: CreateTable,
    inOrganizationId?: string,
  ): Promise<TableDetail> {
    const columns = input.templateId
      ? TABLE_TEMPLATES[input.templateId].map((column) =>
          columnDefinitionSchema.parse(column),
        )
      : [];

    const table = await this.prisma.$transaction((tx) =>
      insertTable(tx, userId, inOrganizationId, {
        name: input.name,
        description: input.description ?? null,
        columns,
      }),
    );
    return this.get(userId, table.id);
  }

  async update(
    userId: string,
    tableId: string,
    patch: UpdateTable,
  ): Promise<TableDetail> {
    await requireTableRole(this.prisma, userId, tableId, 'ADMIN');
    await this.prisma.inventoryTable.update({
      where: { id: tableId },
      data: patch,
    });
    this.realtime.publish(tableId, 'table');
    return this.get(userId, tableId);
  }

  async remove(userId: string, tableId: string): Promise<void> {
    await requireTableRole(this.prisma, userId, tableId, 'ADMIN');
    // Columns, records and shares go with it (ON DELETE CASCADE).
    await this.prisma.inventoryTable.delete({ where: { id: tableId } });
    this.realtime.publish(tableId, 'deleted');
  }
}

/**
 * Creates a table in the personal space, or in an organization the user
 * administers, within the space's table limit. Columns may bring their id.
 */
export async function insertTable(
  tx: Prisma.TransactionClient,
  userId: string,
  inOrganizationId: string | undefined,
  data: {
    name: string;
    description: string | null;
    columns: (ColumnDefinition & { id?: string })[];
  },
): Promise<InventoryTable> {
  if (inOrganizationId) {
    await requireOrganizationRole(tx, userId, inOrganizationId, 'ADMIN');
  }
  const organizationId =
    inOrganizationId ?? (await personalOrganizationId(tx, userId));
  // Serializes concurrent creates, so the limit holds.
  await lockOrganization(tx, organizationId);
  const count = await tx.inventoryTable.count({ where: { organizationId } });
  if (count >= MAX_TABLES_PER_SPACE) {
    throw new UnprocessableEntityException('Table limit reached');
  }
  return tx.inventoryTable.create({
    data: {
      organizationId,
      createdById: userId,
      name: data.name,
      description: data.description,
      columns: {
        create: data.columns.map((column, position) => ({
          ...toColumnData(column),
          ...(column.id && { id: column.id }),
          position,
        })),
      },
    },
  });
}

function toTableSummary(table: TableWithCounts, role: TableRole): TableSummary {
  return {
    role,
    id: table.id,
    name: table.name,
    description: table.description,
    columnCount: table._count.columns,
    recordCount: table._count.records,
    createdAt: table.createdAt.toISOString(),
    updatedAt: table.updatedAt.toISOString(),
  };
}
