import { canGroupBy, canSum, STATS_GROUP_TYPES, type TableColumn } from "@wisedata/shared";

/**
 * Columns worth grouping by. The first one is left out: it usually names each
 * record (product, equipment…), so every group would hold a single record.
 */
export function groupableColumns(columns: TableColumn[]): TableColumn[] {
  return columns.slice(1).filter(canGroupBy);
}

export function summableColumns(columns: TableColumn[]): TableColumn[] {
  return columns.filter(canSum);
}

/** The groupable column of the most useful type (`STATS_GROUP_TYPES` order). */
export function defaultGroupBy(columns: TableColumn[]): TableColumn | undefined {
  const groupable = groupableColumns(columns);
  return STATS_GROUP_TYPES.map((type) => groupable.find((column) => column.type === type)).find(
    Boolean,
  );
}
