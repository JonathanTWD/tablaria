import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type ImportCheck,
  type ImportResult,
  MAX_RECORDS_PER_TABLE,
  type RecordColumn,
} from '@wisedata/shared';
import { toTableColumn } from '../columns/column-mapper';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { RealtimeService } from '../realtime/realtime.service';
import { withoutEmptyCells } from '../records/record-data';
import { requireTableRole, touchTable } from '../tables/table-access';
import {
  analyzeImport,
  type ImportAnalysis,
  type ImportRequest,
  UnknownImportColumnError,
} from './import-analysis';

/** Thousands of rows in one transaction take longer than Prisma's 5 s default. */
const IMPORT_TIMEOUT_MS = 30_000;

/** Importing rows from a file into a table (ADR-021). */
@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** What importing would do, without changing anything. Editors and up. */
  async check(
    userId: string,
    tableId: string,
    request: ImportRequest,
  ): Promise<ImportCheck> {
    await requireTableRole(this.prisma, userId, tableId, 'EDITOR');
    const columns = await loadColumns(this.prisma, tableId);
    return analyze(columns, request).check;
  }

  /** All rows or none: any invalid cell rejects the whole import. */
  async import(
    userId: string,
    tableId: string,
    request: ImportRequest,
  ): Promise<ImportResult> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        // Locks the table: its columns can't change and the limit holds.
        await touchTable(tx, userId, tableId, 'EDITOR');
        const columns = await loadColumns(tx, tableId);
        const { check, records, extendedColumns } = analyze(columns, request);
        if (check.errorCount > 0) {
          throw new UnprocessableEntityException('The file has invalid cells');
        }
        // New choices change the columns, which only admins do.
        if (extendedColumns.length > 0) {
          await requireTableRole(tx, userId, tableId, 'ADMIN');
        }
        const count = await tx.record.count({ where: { tableId } });
        if (count + records.length > MAX_RECORDS_PER_TABLE) {
          throw new UnprocessableEntityException('Record limit reached');
        }

        let addedChoices = 0;
        for (const column of extendedColumns) {
          const before = columns.find(({ id }) => id === column.id);
          if (column.type === 'select' && before?.type === 'select') {
            addedChoices +=
              column.options.choices.length - before.options.choices.length;
            await tx.column.update({
              where: { id: column.id },
              data: { options: column.options },
            });
          }
        }
        await tx.record.createMany({
          data: records.map((data) => ({
            tableId,
            data: withoutEmptyCells(data),
          })),
        });
        return { imported: records.length, addedChoices };
      },
      { timeout: IMPORT_TIMEOUT_MS },
    );

    this.realtime.publish(tableId, 'records');
    if (result.addedChoices > 0) {
      this.realtime.publish(tableId, 'columns');
    }
    return result;
  }
}

function analyze(
  columns: RecordColumn[],
  request: ImportRequest,
): ImportAnalysis {
  try {
    return analyzeImport(columns, request);
  } catch (error) {
    if (error instanceof UnknownImportColumnError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}

async function loadColumns(
  db: Prisma.TransactionClient,
  tableId: string,
): Promise<RecordColumn[]> {
  const columns = await db.column.findMany({ where: { tableId } });
  return columns.map(toTableColumn);
}
