import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  hasRole,
  type ImportCheck,
  type importNewTableSchema,
  type ImportResult,
  MAX_RECORDS_PER_TABLE,
  type RecordColumn,
} from '@wisedata/shared';
import type { z } from 'zod';
import { toColumnData, toTableColumn } from '../columns/column-mapper';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, Role } from '../generated/prisma/client';
import { requireOrganizationRole } from '../organizations/organization-access';
import { RealtimeService } from '../realtime/realtime.service';
import { withoutEmptyCells } from '../records/record-data';
import { requireTableRole, touchTable } from '../tables/table-access';
import { insertTable } from '../tables/tables.service';
import {
  analyzeImport,
  type ImportAnalysis,
  type ImportPlan,
  type ImportRequest,
  InvalidImportError,
  planImport,
} from './import-analysis';

type NewTableRequest = z.output<typeof importNewTableSchema>;

/** Thousands of rows in one transaction take longer than Prisma's 5 s default. */
const IMPORT_TIMEOUT_MS = 30_000;

/** Importing rows from a file into a table, or into a new one (ADR-021). */
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
    const role = await requireTableRole(this.prisma, userId, tableId, 'EDITOR');
    const plan = resolve(await loadColumns(this.prisma, tableId), request);
    requireAdminForNewColumns(role, plan);
    return analyzeImport(plan, request.rows, request.addMissingChoices).check;
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
        const role = await touchTable(tx, userId, tableId, 'EDITOR');
        const existing = await loadColumns(tx, tableId);
        const plan = resolve(existing, request);
        requireAdminForNewColumns(role, plan);
        const analysis = analyzeImport(
          plan,
          request.rows,
          request.addMissingChoices,
        );
        requireImportable(analysis);
        // New choices change the columns, which only admins do.
        if (analysis.extendedColumns.length > 0 && !hasRole(role, 'ADMIN')) {
          throw new ForbiddenException('Only admins add choices');
        }
        const count = await tx.record.count({ where: { tableId } });
        if (count + analysis.records.length > MAX_RECORDS_PER_TABLE) {
          throw new UnprocessableEntityException('Record limit reached');
        }

        const { _max } = await tx.column.aggregate({
          where: { tableId },
          _max: { position: true },
        });
        const first = (_max.position ?? -1) + 1;
        await tx.column.createMany({
          data: analysis.createdColumns.map((column, index) => ({
            ...toColumnData(column),
            id: column.id,
            tableId,
            position: first + index,
          })),
        });
        for (const column of analysis.extendedColumns) {
          await tx.column.update({
            where: { id: column.id },
            data: { options: column.options ?? undefined },
          });
        }
        await storeRecords(tx, tableId, analysis);
        return summary(tableId, existing, analysis);
      },
      { timeout: IMPORT_TIMEOUT_MS },
    );

    this.realtime.publish(tableId, 'records');
    if (result.addedColumns > 0 || result.addedChoices > 0) {
      this.realtime.publish(tableId, 'columns');
    }
    return result;
  }

  /** The check for a table made from a file. Admins of the space. */
  async checkNewTable(
    userId: string,
    organizationId: string,
    request: NewTableRequest,
  ): Promise<ImportCheck> {
    await requireOrganizationRole(this.prisma, userId, organizationId, 'ADMIN');
    const plan = resolve([], request);
    return analyzeImport(plan, request.rows, request.addMissingChoices).check;
  }

  /** Creates the table with its columns and rows, or nothing at all. */
  async importNewTable(
    userId: string,
    organizationId: string,
    request: NewTableRequest,
  ): Promise<ImportResult> {
    const analysis = analyzeImport(
      resolve([], request),
      request.rows,
      request.addMissingChoices,
    );
    requireImportable(analysis);
    return this.prisma.$transaction(
      async (tx) => {
        // Checks the role and the space's table limit, like any new table.
        const table = await insertTable(tx, userId, organizationId, {
          name: request.name,
          description: null,
          columns: analysis.createdColumns,
        });
        await storeRecords(tx, table.id, analysis);
        return summary(table.id, [], analysis);
      },
      { timeout: IMPORT_TIMEOUT_MS },
    );
  }
}

function resolve(existing: RecordColumn[], request: ImportRequest): ImportPlan {
  try {
    return planImport(existing, request.columns);
  } catch (error) {
    if (error instanceof InvalidImportError) {
      throw error.conflict
        ? new ConflictException(error.message)
        : new BadRequestException(error.message);
    }
    throw error;
  }
}

/** New columns change the table, which only admins do. */
function requireAdminForNewColumns(role: Role, plan: ImportPlan): void {
  if (plan.created.length > 0 && !hasRole(role, 'ADMIN')) {
    throw new ForbiddenException('Only admins add columns');
  }
}

function requireImportable({ check }: ImportAnalysis): void {
  if (check.errorCount > 0 || check.missingRequired.length > 0) {
    throw new UnprocessableEntityException('The file has invalid cells');
  }
}

async function storeRecords(
  tx: Prisma.TransactionClient,
  tableId: string,
  analysis: ImportAnalysis,
): Promise<void> {
  await tx.record.createMany({
    data: analysis.records.map((data) => ({
      tableId,
      data: withoutEmptyCells(data),
    })),
  });
}

function choiceCount(column: RecordColumn | undefined): number {
  return column?.type === 'select' ? column.options.choices.length : 0;
}

function summary(
  tableId: string,
  existing: RecordColumn[],
  analysis: ImportAnalysis,
): ImportResult {
  const addedChoices = analysis.extendedColumns.reduce(
    (total, column) =>
      total +
      choiceCount(column) -
      choiceCount(existing.find(({ id }) => id === column.id)),
    0,
  );
  return {
    tableId,
    imported: analysis.records.length,
    addedChoices,
    addedColumns: analysis.createdColumns.length,
  };
}

async function loadColumns(
  db: Prisma.TransactionClient,
  tableId: string,
): Promise<RecordColumn[]> {
  const columns = await db.column.findMany({
    where: { tableId },
    orderBy: { position: 'asc' },
  });
  return columns.map(toTableColumn);
}
