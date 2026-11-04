import { BadRequestException } from '@nestjs/common';
import {
  canGroupMetricsBy,
  canMeasure,
  type MetricFunction,
  type MetricGroup,
  type MetricGroups,
  METRICS_MAX_GROUPS,
  type TableColumn,
} from '@tablaria/shared';
import { Prisma } from '../generated/prisma/client';

/** A number cell of record `r`; NULL when it holds anything else. */
export function numberCell(columnId: string): Prisma.Sql {
  return Prisma.sql`(CASE WHEN jsonb_typeof(r.data -> ${columnId}::text) = 'number'
                     THEN (r.data ->> ${columnId}::text)::float8 END)`;
}

/** `filled` and `measure` of a group of records `r`, NULLs without a column. */
export function measureSql(
  column: TableColumn | null,
  fn: MetricFunction,
): Prisma.Sql {
  if (!column) {
    return Prisma.sql`0 AS filled, NULL::float8 AS measure`;
  }
  const value = numberCell(column.id);
  // A constant from METRIC_FUNCTIONS, never user text.
  return Prisma.sql`count(${value}) AS filled,
    ${Prisma.raw(fn)}(${value})::float8 AS measure`;
}

/** The column a query names, checked against the table's own columns. */
export function findColumn(
  columns: TableColumn[],
  columnId: string,
  fits: (column: TableColumn) => boolean,
  what: string,
): TableColumn {
  const column = columns.find(({ id }) => id === columnId);
  if (!column || !fits(column)) {
    throw new BadRequestException(`Invalid ${what} column`);
  }
  return column;
}

export function groupColumns(
  columns: TableColumn[],
  query: { groupBy: string; column?: string },
): { groupBy: TableColumn; measured: TableColumn | null } {
  return {
    groupBy: findColumn(columns, query.groupBy, canGroupMetricsBy, 'groupBy'),
    measured:
      query.column === undefined
        ? null
        : findColumn(columns, query.column, canMeasure, 'measured'),
  };
}

/** Two groups' measures put together, as `fn` would over all their records. */
function combine(
  fn: MetricFunction,
  a: Omit<MetricGroup, 'value' | 'count'>,
  b: Omit<MetricGroup, 'value' | 'count'>,
): number | null {
  if (a.measure === null || b.measure === null) {
    return a.measure ?? b.measure;
  }
  switch (fn) {
    case 'sum':
      return a.measure + b.measure;
    case 'min':
      return Math.min(a.measure, b.measure);
    case 'max':
      return Math.max(a.measure, b.measure);
    case 'avg':
      // Weighted by how many values each average was made of.
      return (
        (a.measure * a.filled + b.measure * b.filled) / (a.filled + b.filled)
      );
  }
}

/** Keeps the first groups (already sorted largest first) and puts the rest together. */
export function summarizeGroups(
  groups: MetricGroup[],
  total: number,
  fn: MetricFunction,
  labels: Record<string, string> = {},
): MetricGroups {
  const rest = groups.slice(METRICS_MAX_GROUPS);
  return {
    total,
    groups: groups.slice(0, METRICS_MAX_GROUPS),
    others:
      rest.length === 0
        ? null
        : rest.reduce(
            (others, group) => ({
              groupCount: others.groupCount + 1,
              count: others.count + group.count,
              filled: others.filled + group.filled,
              measure: combine(fn, others, group),
            }),
            {
              groupCount: 0,
              count: 0,
              filled: 0,
              measure: null as number | null,
            },
          ),
    labels,
  };
}
