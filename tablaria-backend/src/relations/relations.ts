import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  CellValue,
  ColumnDefinition,
  RecordColumn,
  RecordData,
} from '@tablaria/shared';
import type { Prisma } from '../generated/prisma/client';
import { tableRole } from '../tables/table-access';

/** Relation columns link records to tables of their own space (ADR-022). */

type Db = Prisma.TransactionClient;

type RelationColumn = RecordColumn & {
  type: 'relation';
  options: { tableId: string };
};

export function isRelation(column: RecordColumn): column is RelationColumn {
  return column.type === 'relation';
}

/**
 * A relation column may only link to a table of the same space: links never
 * cross organizations, so nobody sees records of a space they aren't in.
 */
export async function requireLinkableTable(
  db: Db,
  tableId: string,
  definition: ColumnDefinition,
): Promise<void> {
  if (definition.type !== 'relation') {
    return;
  }
  const [table, target] = await Promise.all([
    db.inventoryTable.findUniqueOrThrow({
      where: { id: tableId },
      select: { organizationId: true },
    }),
    db.inventoryTable.findUnique({
      where: { id: definition.options.tableId },
      select: { organizationId: true },
    }),
  ]);
  if (target?.organizationId !== table.organizationId) {
    throw new UnprocessableEntityException(
      'The linked table must be in the same space',
    );
  }
}

/**
 * Every linked record must exist in its column's table, and whoever links to
 * it must be able to open that table.
 */
export async function requireLinkedRecords(
  db: Db,
  userId: string,
  columns: RecordColumn[],
  rows: RecordData[],
): Promise<void> {
  for (const column of columns.filter(isRelation)) {
    const ids = [
      ...new Set(
        rows
          .map((row) => row[column.id])
          .filter((value): value is string => typeof value === 'string'),
      ),
    ];
    if (ids.length === 0) {
      continue;
    }
    if (!(await tableRole(db, userId, column.options.tableId))) {
      throw new ForbiddenException('No access to the linked table');
    }
    const found = await db.record.count({
      where: { id: { in: ids }, tableId: column.options.tableId },
    });
    if (found !== ids.length) {
      throw new UnprocessableEntityException('Linked record not found');
    }
  }
}

/**
 * The label (first column, as text) of every record the rows link to, for
 * the tables the user can open. Others are left out on purpose.
 */
export async function linkedLabels(
  db: Db,
  userId: string,
  columns: RecordColumn[],
  rows: RecordData[],
): Promise<Record<string, string>> {
  const idsByTable = new Map<string, Set<string>>();
  for (const column of columns.filter(isRelation)) {
    for (const row of rows) {
      const id = row[column.id];
      if (typeof id === 'string') {
        const ids = idsByTable.get(column.options.tableId) ?? new Set<string>();
        ids.add(id);
        idsByTable.set(column.options.tableId, ids);
      }
    }
  }

  const labels: Record<string, string> = {};
  for (const [tableId, ids] of idsByTable) {
    if (!(await tableRole(db, userId, tableId))) {
      continue;
    }
    const first = await db.column.findFirst({
      where: { tableId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    const records = await db.record.findMany({
      where: { tableId, id: { in: [...ids] } },
      select: { id: true, data: true },
    });
    for (const record of records) {
      const value = first
        ? (record.data as Record<string, CellValue>)[first.id]
        : null;
      labels[record.id] =
        value === null || value === undefined ? '' : String(value);
    }
  }
  return labels;
}

/**
 * Empties the cells that linked to a deleted record; returns the tables they
 * are in, so their open pages refresh.
 */
export async function unlinkRecord(
  tx: Db,
  tableId: string,
  recordId: string,
): Promise<string[]> {
  const rows = await tx.$queryRaw<{ tableId: string }[]>`
    UPDATE records AS r
    SET data = r.data - c.id::text
    FROM columns AS c
    WHERE c.type = 'relation'
      AND c.options ->> 'tableId' = ${tableId}
      AND r."tableId" = c."tableId"
      AND r.data ->> c.id::text = ${recordId}
    RETURNING r."tableId"`;
  return [...new Set(rows.map((row) => row.tableId))];
}

/**
 * Deletes the relation columns of other tables that link to a table being
 * deleted (their cells go with them); returns those tables.
 */
export async function dropRelationsTo(
  tx: Db,
  tableId: string,
): Promise<string[]> {
  const columns = await tx.$queryRaw<{ id: string; tableId: string }[]>`
    SELECT id, "tableId" FROM columns
    WHERE type = 'relation'
      AND options ->> 'tableId' = ${tableId}
      AND "tableId" <> ${tableId}::uuid`;
  for (const column of columns) {
    await tx.$executeRaw`
      UPDATE records SET data = data - ${column.id}::text
      WHERE "tableId" = ${column.tableId}::uuid`;
  }
  await tx.column.deleteMany({
    where: { id: { in: columns.map(({ id }) => id) } },
  });
  return [...new Set(columns.map((column) => column.tableId))];
}
