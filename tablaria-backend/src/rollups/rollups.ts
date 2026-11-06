import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  canRollUp,
  type ColumnDefinition,
  type ColumnType,
  type RecordColumn,
  type RecordData,
  type RelationOptions,
  type RollupFunction,
  type TableColumn,
} from '@tablaria/shared';
import { toTableColumn } from '../columns/column-mapper';
import { Prisma } from '../generated/prisma/client';
import { tableRole } from '../tables/table-access';

/**
 * Rollups sum up, for each record, the records whose relation links to it,
 * computed when read and never stored (ADR-031).
 */

type Db = Prisma.TransactionClient;

type RollupColumn = RecordColumn & {
  type: 'rollup';
  options: {
    relationColumnId: string;
    function: RollupFunction;
    targetColumnId: string | null;
  };
};

export function isRollup(column: RecordColumn): column is RollupColumn {
  return column.type === 'rollup';
}

/** Where a rollup's values come from, for a user who can open that table. */
export interface RollupSource {
  /** The table whose records link here (it may be this same table). */
  tableId: string;
  /** The relation column, in that table, that links to this one. */
  relationColumnId: string;
  /** That relation links each record to a list of these (ADR-032). */
  multiple: boolean;
  function: RollupFunction;
  /** The column it sums up; null when it counts. */
  target: TableColumn | null;
}

/**
 * A rollup sums up through a relation column, of any table of the space,
 * that links to this table, over a column of that table that fits its
 * function; whoever defines it must be able to open that table.
 */
export async function requireRollupSource(
  db: Db,
  userId: string,
  tableId: string,
  definition: ColumnDefinition,
): Promise<void> {
  if (definition.type !== 'rollup') {
    return;
  }
  const relation = await db.column.findUnique({
    where: { id: definition.options.relationColumnId },
  });
  if (
    relation?.type !== 'relation' ||
    (relation.options as { tableId: string }).tableId !== tableId
  ) {
    throw new UnprocessableEntityException(
      'A rollup sums up through a relation that links to this table',
    );
  }
  if (!(await tableRole(db, userId, relation.tableId))) {
    throw new ForbiddenException('No access to the linking table');
  }
  const { function: fn, targetColumnId } = definition.options;
  if (targetColumnId === null) {
    return;
  }
  const target = await db.column.findFirst({
    where: { id: targetColumnId, tableId: relation.tableId },
  });
  if (!target || !canRollUp(fn, target.type)) {
    throw new UnprocessableEntityException(
      `A ${fn} needs a fitting column of the linking table`,
    );
  }
}

/**
 * For each rollup whose linking table the user can open, where its values
 * come from. Rollups of other tables are left out: they show nothing.
 */
export async function rollupSources(
  db: Db,
  userId: string,
  columns: RecordColumn[],
): Promise<Map<string, RollupSource>> {
  const sources = new Map<string, RollupSource>();
  const access = new Map<string, boolean>();
  for (const rollup of columns.filter(isRollup)) {
    const relation = await db.column.findUnique({
      where: { id: rollup.options.relationColumnId },
    });
    if (relation?.type !== 'relation') {
      continue;
    }
    if (!access.has(relation.tableId)) {
      access.set(
        relation.tableId,
        (await tableRole(db, userId, relation.tableId)) !== null,
      );
    }
    if (!access.get(relation.tableId)) {
      continue;
    }
    const { function: fn, targetColumnId } = rollup.options;
    const target =
      targetColumnId === null
        ? null
        : await db.column.findFirst({
            where: { id: targetColumnId, tableId: relation.tableId },
          });
    if (targetColumnId !== null && (!target || !canRollUp(fn, target.type))) {
      continue;
    }
    sources.set(rollup.id, {
      tableId: relation.tableId,
      relationColumnId: relation.id,
      multiple: (relation.options as RelationOptions).multiple,
      function: fn,
      target: target && toTableColumn(target),
    });
  }
  return sources;
}

/** The aggregate in SQL, over the linking records `b`, as a number or an ISO date. */
function aggregateSql(source: RollupSource): Prisma.Sql {
  if (source.target === null) {
    return Prisma.sql`count(*)::float8`;
  }
  const column = source.target.id;
  const isDate = source.target.type === 'date';
  // Only cells of the right JSON type: a stray value never breaks the cast.
  const value = isDate
    ? Prisma.sql`(CASE WHEN jsonb_typeof(b.data -> ${column}::text) = 'string'
                       THEN (b.data ->> ${column}::text)::date END)`
    : Prisma.sql`(CASE WHEN jsonb_typeof(b.data -> ${column}::text) = 'number'
                       THEN (b.data ->> ${column}::text)::numeric END)`;
  switch (source.function) {
    case 'sum':
      return Prisma.sql`sum(${value})::float8`;
    case 'avg':
      return Prisma.sql`round(avg(${value}), 6)::float8`;
    default: {
      const fn = Prisma.raw(source.function === 'min' ? 'min' : 'max');
      return isDate
        ? Prisma.sql`${fn}(${value})::text`
        : Prisma.sql`${fn}(${value})::float8`;
    }
  }
}

/**
 * The linking records `b` with, as `link`, the id of each record they link
 * to: one row per link, so a multiple relation counts in every record it
 * lists (ADR-032).
 */
function linksSql(source: RollupSource): Prisma.Sql {
  const column = source.relationColumnId;
  return source.multiple
    ? Prisma.sql`records b CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(b.data -> ${column}::text) = 'array'
             THEN b.data -> ${column}::text END) AS l(link)`
    : Prisma.sql`(SELECT b.*, b.data ->> ${column}::text AS link FROM records b) b`;
}

/** What a rollup shows when nothing links here: none counted and nothing added up. */
export function emptyRollupValue(source: RollupSource): 0 | null {
  return source.function === 'count' || source.function === 'sum' ? 0 : null;
}

/** How a rollup's values compare: dates as dates, everything else as numbers. */
export function rollupValueType(source: RollupSource): 'number' | 'date' {
  return source.target?.type === 'date' ? 'date' : 'number';
}

/**
 * Every record's rollup value at once, as rows of `link` (the record id, as
 * text) and `value`: what a listing joins to sort and filter by it. Records
 * nothing links to have no row (see `emptyRollupValue`).
 */
export function rollupValuesSql(source: RollupSource): Prisma.Sql {
  return Prisma.sql`(SELECT link, ${aggregateSql(source)} AS value
    FROM ${linksSql(source)}
    WHERE b."tableId" = ${source.tableId}::uuid
    GROUP BY link)`;
}

/**
 * Writes each rollup's value into the records' data, as if it were stored:
 * one grouped query per rollup over the records that link to these.
 */
export async function fillRollups(
  db: Db,
  sources: ReadonlyMap<string, RollupSource>,
  records: { id: string; data: RecordData }[],
): Promise<void> {
  if (records.length === 0) {
    return;
  }
  const ids = records.map(({ id }) => id);
  for (const [rollupId, source] of sources) {
    const rows = await db.$queryRaw<
      { id: string; value: number | string | null }[]
    >`
      SELECT link AS id, ${aggregateSql(source)} AS value
      FROM ${linksSql(source)}
      WHERE b."tableId" = ${source.tableId}::uuid
        AND link = ANY(${ids}::text[])
      GROUP BY 1`;
    const byId = new Map(rows.map(({ id, value }) => [id, value]));
    const empty = emptyRollupValue(source);
    for (const record of records) {
      const value = byId.get(record.id) ?? empty;
      if (value !== null) {
        record.data[rollupId] = value;
      }
    }
  }
}

/**
 * Deletes the rollups summing up a column whose new type no longer fits
 * their function; returns the tables they were in.
 */
export async function dropRollupsNotFitting(
  tx: Db,
  targetColumnId: string,
  type: ColumnType,
): Promise<string[]> {
  const rollups = await tx.column.findMany({
    where: {
      type: 'rollup',
      options: { path: ['targetColumnId'], equals: targetColumnId },
    },
    select: { id: true, tableId: true, options: true },
  });
  const unfit = rollups.filter(
    ({ options }) =>
      !canRollUp((options as { function: RollupFunction }).function, type),
  );
  await tx.column.deleteMany({
    where: { id: { in: unfit.map(({ id }) => id) } },
  });
  return [...new Set(unfit.map(({ tableId }) => tableId))];
}
