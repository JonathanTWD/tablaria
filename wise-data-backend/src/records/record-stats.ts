import { BadRequestException } from '@nestjs/common';
import {
  canGroupBy,
  canSum,
  type RecordStats,
  type RecordStatsQuery,
  STATS_MAX_GROUPS,
  type StatsGroup,
  type TableColumn,
} from '@wisedata/shared';

/** The columns the query names, checked against the table's own columns. */
export function statsColumns(
  columns: TableColumn[],
  query: RecordStatsQuery,
): { groupBy: TableColumn; sum: TableColumn | null } {
  const groupBy = columns.find(({ id }) => id === query.groupBy);
  if (!groupBy || !canGroupBy(groupBy)) {
    throw new BadRequestException('Invalid groupBy column');
  }
  if (query.sum === undefined) {
    return { groupBy, sum: null };
  }
  const sum = columns.find(({ id }) => id === query.sum);
  if (!sum || !canSum(sum)) {
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
