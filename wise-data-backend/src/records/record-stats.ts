import { BadRequestException } from '@nestjs/common';
import {
  type RecordStats,
  type RecordStatsQuery,
  STATS_GROUP_TYPES,
  STATS_MAX_GROUPS,
  STATS_SUM_TYPES,
  type StatsGroup,
  type TableColumn,
} from '@wisedata/shared';

const isOneOf = <T extends string>(
  list: readonly T[],
  value: string,
): value is T => (list as readonly string[]).includes(value);

/** The columns the query names, checked against the table's own columns. */
export function statsColumns(
  columns: TableColumn[],
  query: RecordStatsQuery,
): { groupBy: TableColumn; sum: TableColumn | null } {
  const groupBy = columns.find(({ id }) => id === query.groupBy);
  if (!groupBy || !isOneOf(STATS_GROUP_TYPES, groupBy.type)) {
    throw new BadRequestException('Invalid groupBy column');
  }
  if (query.sum === undefined) {
    return { groupBy, sum: null };
  }
  const sum = columns.find(({ id }) => id === query.sum);
  if (!sum || !isOneOf(STATS_SUM_TYPES, sum.type)) {
    throw new BadRequestException('Invalid sum column');
  }
  return { groupBy, sum };
}

const addSums = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : a + b;

/** Keeps the first groups (already sorted largest first) and adds up the rest. */
export function summarizeGroups(
  groups: StatsGroup[],
  total: number,
): RecordStats {
  const rest = groups.slice(STATS_MAX_GROUPS);
  return {
    total,
    groups: groups.slice(0, STATS_MAX_GROUPS),
    others:
      rest.length === 0
        ? null
        : {
            groupCount: rest.length,
            count: rest.reduce((sum, group) => sum + group.count, 0),
            sum: rest.reduce<number | null>(
              (sum, group) => addSums(sum, group.sum),
              null,
            ),
          },
  };
}
