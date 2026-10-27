import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  MAX_RECORDS_PER_TABLE,
  type Paginated,
  type RecordColumn,
  type RecordData,
  recordDataSchema,
  type RecordInput,
  type RecordListQuery,
  type TableRecord,
} from '@wisedata/shared';
import { toTableColumn } from '../columns/column-mapper';
import { parseOrThrow } from '../common/pipes/zod-validation.pipe';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, Record as RecordRow } from '../generated/prisma/client';
import { touchOwnedTable } from '../tables/table-access';
import { buildRecordQuery } from './record-query';

@Injectable()
export class RecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    ownerId: string,
    tableId: string,
    query: RecordListQuery,
  ): Promise<Paginated<TableRecord>> {
    const table = await this.prisma.inventoryTable.findFirst({
      where: { id: tableId, ownerId },
      select: { columns: true },
    });
    if (!table) {
      throw new NotFoundException('Table not found');
    }

    const { where, orderBy } = buildRecordQuery(
      tableId,
      table.columns.map(toTableColumn),
      query,
    );
    const offset = (query.page - 1) * query.pageSize;
    const [rows, [{ total }]] = await Promise.all([
      this.prisma.$queryRaw<RecordRow[]>`
        SELECT r.id, r."tableId", r.data, r."createdAt", r."updatedAt"
        FROM records r
        WHERE ${where}
        ORDER BY ${orderBy}
        LIMIT ${query.pageSize} OFFSET ${offset}`,
      this.prisma.$queryRaw<{ total: bigint }[]>`
        SELECT count(*) AS total FROM records r WHERE ${where}`,
    ]);

    const count = Number(total);
    return {
      data: rows.map(toTableRecord),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: count,
        pageCount: Math.ceil(count / query.pageSize),
      },
    };
  }

  create(
    ownerId: string,
    tableId: string,
    input: RecordInput,
  ): Promise<TableRecord> {
    return this.prisma.$transaction(async (tx) => {
      // Also blocks column changes (type conversions) until this write ends.
      await touchOwnedTable(tx, ownerId, tableId);

      const count = await tx.record.count({ where: { tableId } });
      if (count >= MAX_RECORDS_PER_TABLE) {
        throw new UnprocessableEntityException('Record limit reached');
      }

      const columns = await loadColumns(tx, tableId);
      const data = parseOrThrow(
        recordDataSchema(columns, { partial: false }),
        input.data,
      );
      const record = await tx.record.create({
        data: { tableId, data: withoutEmptyCells(data) },
      });
      return toTableRecord(record);
    });
  }

  update(
    ownerId: string,
    tableId: string,
    recordId: string,
    input: RecordInput,
  ): Promise<TableRecord> {
    return this.prisma.$transaction(async (tx) => {
      await touchOwnedTable(tx, ownerId, tableId);

      const stored = await tx.record.findFirst({
        where: { id: recordId, tableId },
      });
      if (!stored) {
        throw new NotFoundException('Record not found');
      }

      const columns = await loadColumns(tx, tableId);
      const changes = parseOrThrow(
        recordDataSchema(columns, { partial: true }),
        input.data,
      );
      const record = await tx.record.update({
        where: { id: recordId },
        data: {
          data: withoutEmptyCells({
            ...toTableRecord(stored).data,
            ...changes,
          }),
        },
      });
      return toTableRecord(record);
    });
  }

  async remove(
    ownerId: string,
    tableId: string,
    recordId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await touchOwnedTable(tx, ownerId, tableId);
      const { count } = await tx.record.deleteMany({
        where: { id: recordId, tableId },
      });
      if (count === 0) {
        throw new NotFoundException('Record not found');
      }
    });
  }
}

async function loadColumns(
  tx: Prisma.TransactionClient,
  tableId: string,
): Promise<RecordColumn[]> {
  const columns = await tx.column.findMany({ where: { tableId } });
  return columns.map(toTableColumn);
}

/** Empty cells are stored as absent keys, never as null. */
function withoutEmptyCells(data: RecordData): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== null),
  );
}

function toTableRecord(record: RecordRow): TableRecord {
  return {
    id: record.id,
    // Validated against the table's columns whenever it is written.
    data: record.data as RecordData,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
