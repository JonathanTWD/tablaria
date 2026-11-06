import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  MAX_RECORDS_PER_TABLE,
  type Paginated,
  type RecordGroup,
  type RecordPage,
  type RecordColumn,
  type RecordData,
  recordDataSchema,
  type RecordExportQuery,
  type RecordInput,
  type RecordListQuery,
  type TableRecord,
} from '@tablaria/shared';
import { toTableColumn } from '../columns/column-mapper';
import {
  changedColumns,
  logActivity,
  recordLabel,
} from '../activity/activity-log';
import { parseOrThrow } from '../common/pipes/zod-validation.pipe';
import { PrismaService } from '../database/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { Prisma, type Record as RecordRow } from '../generated/prisma/client';
import {
  labelSources,
  type LabelSource,
  linkedLabels,
  requireLinkedRecords,
  unlinkRecord,
} from '../relations/relations';
import { accessibleTables, touchTable } from '../tables/table-access';
import { buildRecordQuery } from './record-query';
import {
  fillRollups,
  type RollupSource,
  rollupSources,
} from '../rollups/rollups';
import { fillFormulas } from '../formulas/formulas';
import {
  fillLookups,
  lookupLabelSources,
  lookupSources,
} from '../lookups/lookups';
import { logStockChanges } from '../stock-movements/stock-log';
import { toTableRecord, withoutEmptyCells } from './record-data';
import { requireUniqueValues } from './unique-values';
import { exportFileName, toCsv } from './record-export';

export interface ExportedFile {
  fileName: string;
  contentType: string;
  content: Buffer;
}

@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(
    userId: string,
    tableId: string,
    query: RecordListQuery,
  ): Promise<RecordPage> {
    const table = await this.prisma.inventoryTable.findFirst({
      where: { id: tableId, ...accessibleTables(userId) },
      select: { columns: true },
    });
    if (!table) {
      throw new NotFoundException('Table not found');
    }

    const columns = table.columns.map(toTableColumn);
    const relations = await labelSources(this.prisma, userId, columns);
    const lookups = await lookupSources(this.prisma, userId, columns);
    const rollups = await rollupSources(this.prisma, userId, columns);
    const page = await queryRecordPage(
      this.prisma,
      tableId,
      columns,
      query,
      [...relations, ...lookupLabelSources(lookups)],
      rollups,
    );
    await fillLookups(this.prisma, lookups, page.data);
    await fillRollups(this.prisma, rollups, page.data);
    fillFormulas(columns, page.data);
    return {
      ...page,
      linked: await linkedLabels(
        this.prisma,
        userId,
        columns,
        page.data.map(({ data }) => data),
      ),
      labelledRelations: [...relations.keys()],
    };
  }

  /** Every record that matches the view (search, filters, sort), in column order. */
  async export(
    userId: string,
    tableId: string,
    query: RecordExportQuery,
  ): Promise<ExportedFile> {
    const table = await this.prisma.inventoryTable.findFirst({
      where: { id: tableId, ...accessibleTables(userId) },
      select: { name: true, columns: { orderBy: { position: 'asc' } } },
    });
    if (!table) {
      throw new NotFoundException('Table not found');
    }

    const columns = table.columns.map(toTableColumn);
    const lookups = await lookupSources(this.prisma, userId, columns);
    const rollups = await rollupSources(this.prisma, userId, columns);
    const { from, where, orderBy } = buildRecordQuery(
      tableId,
      columns,
      query,
      new Map([
        ...(await labelSources(this.prisma, userId, columns)),
        ...lookupLabelSources(lookups),
      ]),
      rollups,
    );
    const rows = await this.prisma.$queryRaw<
      { id: string; data: RecordData }[]
    >`
      SELECT r.id, r.data FROM ${from}
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${MAX_RECORDS_PER_TABLE}`;
    await fillLookups(this.prisma, lookups, rows);
    await fillRollups(this.prisma, rollups, rows);
    fillFormulas(columns, rows);

    return {
      fileName: exportFileName(table.name, 'csv'),
      contentType: 'text/csv; charset=utf-8',
      content: Buffer.from(
        toCsv(
          columns,
          rows.map(({ data }) => data),
          // Linked records by their label, as the table shows them.
          await linkedLabels(
            this.prisma,
            userId,
            columns,
            rows.map(({ data }) => data),
          ),
          // Lookups and rollups are formatted like the column they show.
          new Map([
            ...[...lookups].map(([id, { target }]) => [id, target] as const),
            ...[...rollups].flatMap(([id, { target }]) =>
              target ? [[id, target] as const] : [],
            ),
          ]),
        ),
        'utf8',
      ),
    };
  }

  async create(
    userId: string,
    tableId: string,
    input: RecordInput,
  ): Promise<TableRecord> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Also blocks column changes (type conversions) until this write ends.
      await touchTable(tx, userId, tableId, 'EDITOR');

      const count = await tx.record.count({ where: { tableId } });
      if (count >= MAX_RECORDS_PER_TABLE) {
        throw new UnprocessableEntityException('Record limit reached');
      }

      const columns = await loadColumns(tx, tableId);
      const data = parseOrThrow(
        recordDataSchema(columns, { partial: false }),
        input.data,
      );
      await requireLinkedRecords(tx, userId, columns, [data]);
      await requireUniqueValues(tx, tableId, columns, data);
      const record = await tx.record.create({
        data: { tableId, data: withoutEmptyCells(data) },
      });
      await logStockChanges(tx, {
        tableId,
        userId,
        kind: 'EDIT',
        columns,
        writes: [{ id: record.id, before: {}, after: data }],
      });
      await logActivity(tx, {
        tableId,
        userId,
        action: 'record.created',
        recordId: record.id,
        label: recordLabel(columns[0], data),
      });
      return toTableRecord(record);
    });
    this.realtime.publish(tableId, 'records');
    return result;
  }

  async update(
    userId: string,
    tableId: string,
    recordId: string,
    input: RecordInput,
  ): Promise<TableRecord> {
    const result = await this.prisma.$transaction(async (tx) => {
      await touchTable(tx, userId, tableId, 'EDITOR');

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
      await requireLinkedRecords(tx, userId, columns, [changes]);
      await requireUniqueValues(tx, tableId, columns, changes, recordId);
      const before = toTableRecord(stored).data;
      const record = await tx.record.update({
        where: { id: recordId },
        data: { data: withoutEmptyCells({ ...before, ...changes }) },
      });
      await logStockChanges(tx, {
        tableId,
        userId,
        kind: 'EDIT',
        columns,
        writes: [{ id: recordId, before, after: { ...before, ...changes } }],
      });
      const after = { ...before, ...changes };
      const changed = changedColumns(columns, before, after);
      if (changed.length > 0) {
        await logActivity(tx, {
          tableId,
          userId,
          action: 'record.updated',
          recordId,
          label: recordLabel(columns[0], after),
          details: { columns: changed },
        });
      }
      return toTableRecord(record);
    });
    this.realtime.publish(tableId, 'records');
    return result;
  }

  async remove(
    userId: string,
    tableId: string,
    recordId: string,
  ): Promise<void> {
    const unlinked = await this.prisma.$transaction(async (tx) => {
      await touchTable(tx, userId, tableId, 'EDITOR');
      const stored = await tx.record.findFirst({
        where: { id: recordId, tableId },
      });
      if (!stored) {
        throw new NotFoundException('Record not found');
      }
      await tx.record.delete({ where: { id: recordId } });
      const [first] = await loadColumns(tx, tableId);
      await logActivity(tx, {
        tableId,
        userId,
        action: 'record.deleted',
        recordId,
        label: recordLabel(first, stored.data as RecordData),
      });
      // Cells of other tables that linked to it are emptied, not left dangling.
      return unlinkRecord(tx, tableId, recordId);
    });
    this.realtime.publish(tableId, 'records');
    for (const linkingTable of unlinked) {
      this.realtime.publish(linkingTable, 'records');
    }
  }
}

/**
 * One page of the records that match the view (search, filters, sort).
 * `columns` are the ones the view may use: any other column it names is a 400.
 */
export async function queryRecordPage(
  db: PrismaService,
  tableId: string,
  columns: RecordColumn[],
  query: RecordListQuery,
  labels?: Iterable<[string, LabelSource]>,
  rollups?: ReadonlyMap<string, RollupSource>,
): Promise<Paginated<TableRecord> & { groups: RecordGroup[] }> {
  const { from, where, orderBy, groupValue } = buildRecordQuery(
    tableId,
    columns,
    query,
    new Map(labels),
    rollups,
  );
  const offset = (query.page - 1) * query.pageSize;
  const [rows, [{ total }], groups] = await Promise.all([
    db.$queryRaw<RecordRow[]>`
      SELECT r.id, r."tableId", r.data, r."createdAt", r."updatedAt"
      FROM ${from}
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${query.pageSize} OFFSET ${offset}`,
    db.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total FROM ${from} WHERE ${where}`,
    // Counts for every group, so a group split across pages shows its real size.
    groupValue
      ? db.$queryRaw<RecordGroup[]>`
          SELECT ${groupValue} AS value, count(*)::int AS count
          FROM ${from} WHERE ${where} GROUP BY 1`
      : Promise.resolve([]),
  ]);
  const count = Number(total);
  return {
    groups,
    data: rows.map(toTableRecord),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total: count,
      pageCount: Math.ceil(count / query.pageSize),
    },
  };
}

async function loadColumns(
  tx: Prisma.TransactionClient,
  tableId: string,
): Promise<RecordColumn[]> {
  // By position: the first one names the record in the history.
  const columns = await tx.column.findMany({
    where: { tableId },
    orderBy: { position: 'asc' },
  });
  return columns.map(toTableColumn);
}
