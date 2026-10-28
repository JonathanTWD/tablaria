import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  columnDefinitionSchema,
  type createTableSchema,
  MAX_TABLES_PER_USER,
  TABLE_TEMPLATES,
  type TableDetail,
  type TableSummary,
  type updateTableSchema,
} from '@wisedata/shared';
import type { z } from 'zod';
import { toColumnData, toTableColumn } from '../columns/column-mapper';
import { PrismaService } from '../database/prisma.service';
import type { InventoryTable } from '../generated/prisma/client';
import {
  accessibleTables,
  personalOrganizationId,
  requireTableRole,
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
  constructor(private readonly prisma: PrismaService) {}

  /** The tables of the user's personal space. */
  async list(userId: string): Promise<TableSummary[]> {
    const organizationId = await personalOrganizationId(this.prisma, userId);
    const tables = await this.prisma.inventoryTable.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      include: WITH_COUNTS,
    });
    return tables.map(toTableSummary);
  }

  async get(userId: string, tableId: string): Promise<TableDetail> {
    const table = await this.prisma.inventoryTable.findFirst({
      where: { id: tableId, ...accessibleTables(userId) },
      include: { ...WITH_COUNTS, columns: { orderBy: { position: 'asc' } } },
    });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    return {
      ...toTableSummary(table),
      columns: table.columns.map(toTableColumn),
    };
  }

  async create(userId: string, input: CreateTable): Promise<TableDetail> {
    const columns = input.templateId
      ? TABLE_TEMPLATES[input.templateId].map((column) =>
          columnDefinitionSchema.parse(column),
        )
      : [];

    const table = await this.prisma.$transaction(async (tx) => {
      const organizationId = await personalOrganizationId(tx, userId);
      // Locking the organization serializes concurrent creates, so the limit holds.
      await tx.$executeRaw`SELECT 1 FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
      const count = await tx.inventoryTable.count({
        where: { organizationId },
      });
      if (count >= MAX_TABLES_PER_USER) {
        throw new UnprocessableEntityException('Table limit reached');
      }
      return tx.inventoryTable.create({
        data: {
          organizationId,
          createdById: userId,
          name: input.name,
          description: input.description ?? null,
          columns: {
            create: columns.map((column, position) => ({
              ...toColumnData(column),
              position,
            })),
          },
        },
      });
    });
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
    return this.get(userId, tableId);
  }

  async remove(userId: string, tableId: string): Promise<void> {
    await requireTableRole(this.prisma, userId, tableId, 'ADMIN');
    // Columns, records and shares go with it (ON DELETE CASCADE).
    await this.prisma.inventoryTable.delete({ where: { id: tableId } });
  }
}

function toTableSummary(table: TableWithCounts): TableSummary {
  return {
    id: table.id,
    name: table.name,
    description: table.description,
    columnCount: table._count.columns,
    recordCount: table._count.records,
    createdAt: table.createdAt.toISOString(),
    updatedAt: table.updatedAt.toISOString(),
  };
}
