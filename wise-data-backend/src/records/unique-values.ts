import { ConflictException } from '@nestjs/common';
import type { CellValue, RecordColumn, RecordData } from '@wisedata/shared';
import { Prisma } from '../generated/prisma/client';

/** Unique columns refuse a value another record already holds (ADR-023). */

type Db = Prisma.TransactionClient;

/** No record has this id: stands for "no record to skip". */
const NO_RECORD = '00000000-0000-0000-0000-000000000000';

/**
 * What two values must share to count as the same: text ignoring case and
 * surrounding spaces ("SKU-1" and " sku-1"), numbers by their value.
 */
export function uniqueKey(value: CellValue | undefined): string | null {
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    return key === '' ? null : key;
  }
  return typeof value === 'number' ? String(value) : null;
}

/**
 * The SQL expression of a column's key, like `uniqueKey` but computed by
 * PostgreSQL: compare it only with `valueSql`. Numbers compare as numeric,
 * since PostgreSQL writes 1e21 or 1e-7 in full, unlike JavaScript.
 */
function keySql(column: RecordColumn): Prisma.Sql {
  return column.type === 'text'
    ? Prisma.sql`lower(btrim(data ->> ${column.id}::text))`
    : Prisma.sql`(CASE WHEN jsonb_typeof(data -> ${column.id}::text) = 'number'
                       THEN (data -> ${column.id}::text)::numeric END)`;
}

/** A value's key computed like `keySql`, so both sides lowercase alike. */
function valueSql(column: RecordColumn, value: CellValue): Prisma.Sql {
  return column.type === 'text'
    ? Prisma.sql`lower(btrim(${String(value)}::text))`
    : Prisma.sql`${String(value)}::numeric`;
}

/**
 * Each taken key of a unique column, with the record that holds it. Keys are
 * made by `uniqueKey`, as the import makes them for the file's values.
 */
export async function takenKeys(
  db: Db,
  tableId: string,
  column: RecordColumn,
): Promise<Map<string, string>> {
  const rows = await db.$queryRaw<{ id: string; value: CellValue }[]>`
    SELECT id, data -> ${column.id}::text AS value FROM records
    WHERE "tableId" = ${tableId}::uuid AND data ? ${column.id}::text`;
  return new Map(
    rows.flatMap(({ id, value }) => {
      const key = uniqueKey(value);
      return key === null ? [] : [[key, id] as const];
    }),
  );
}

/**
 * Throws 409 when a unique cell of `data` repeats another record's value.
 * Call inside the transaction that locked the table (touchTable).
 */
export async function requireUniqueValues(
  db: Db,
  tableId: string,
  columns: RecordColumn[],
  data: RecordData,
  exceptRecordId = NO_RECORD,
): Promise<void> {
  for (const column of columns) {
    const value = data[column.id];
    if (!column.unique || uniqueKey(value) === null) {
      continue;
    }
    const [clash] = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM records
      WHERE "tableId" = ${tableId}::uuid
        AND id <> ${exceptRecordId}::uuid
        AND ${keySql(column)} = ${valueSql(column, value)}
      LIMIT 1`;
    if (clash) {
      throw duplicateValues([{ column, value: String(value) }]);
    }
  }
}

/**
 * Throws 409 when a column that becomes unique already holds repeated
 * values, naming a few of them.
 */
export async function requireNoRepeatedValues(
  db: Db,
  tableId: string,
  column: RecordColumn,
): Promise<void> {
  const repeated = await db.$queryRaw<{ value: string }[]>`
    SELECT min(data ->> ${column.id}::text) AS value FROM records
    WHERE "tableId" = ${tableId}::uuid AND data ? ${column.id}::text
    GROUP BY ${keySql(column)}
    HAVING count(*) > 1
    LIMIT 5`;
  if (repeated.length > 0) {
    throw duplicateValues(repeated.map(({ value }) => ({ column, value })));
  }
}

function duplicateValues(clashes: { column: RecordColumn; value: string }[]) {
  return new ConflictException({
    message: 'Value already used in a unique column',
    details: clashes.map(({ column, value }) => ({
      path: column.id,
      message: value,
    })),
  });
}
