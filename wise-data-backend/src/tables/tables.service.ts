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

  async list(ownerId: string): Promise<TableSummary[]> {
    const tables = await this.prisma.inventoryTable.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      include: WITH_COUNTS,
    });
    return tables.map(toTableSummary);
  }

  async get(ownerId: string, tableId: string): Promise<TableDetail> {
    const table = await this.prisma.inventoryTable.findFirst({
      where: { id: tableId, ownerId },
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

  async create(ownerId: string, input: CreateTable): Promise<TableDetail> {
    const columns = input.templateId
      ? TABLE_TEMPLATES[input.templateId].map((column) =>
          columnDefinitionSchema.parse(column),
        )
      : [];

    const table = await this.prisma.$transaction(async (tx) => {
      // Locking the owner serializes concurrent creates, so the limit holds.
      await tx.$executeRaw`SELECT 1 FROM users WHERE id = ${ownerId}::uuid FOR UPDATE`;
      const owned = await tx.inventoryTable.count({ where: { ownerId } });
      if (owned >= MAX_TABLES_PER_USER) {
        throw new UnprocessableEntityException('Table limit reached');
      }
      return tx.inventoryTable.create({
        data: {
          ownerId,
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
    return this.get(ownerId, table.id);
  }

  async update(
    ownerId: string,
    tableId: string,
    patch: UpdateTable,
  ): Promise<TableDetail> {
    const { count } = await this.prisma.inventoryTable.updateMany({
      where: { id: tableId, ownerId },
      data: patch,
    });
    if (count === 0) {
      throw new NotFoundException('Table not found');
    }
    return this.get(ownerId, tableId);
  }

  async remove(ownerId: string, tableId: string): Promise<void> {
    // Columns and records go with it (ON DELETE CASCADE).
    const { count } = await this.prisma.inventoryTable.deleteMany({
      where: { id: tableId, ownerId },
    });
    if (count === 0) {
      throw new NotFoundException('Table not found');
    }
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
