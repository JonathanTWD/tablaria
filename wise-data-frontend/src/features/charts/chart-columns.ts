import {
  STATS_GROUP_TYPES,
  STATS_SUM_TYPES,
  type ColumnType,
  type TableColumn,
} from "@wisedata/shared";

const isOneOf = (types: readonly ColumnType[], column: TableColumn) =>
  types.includes(column.type);

/**
 * Columns worth grouping by. The first one is left out: it usually names each
 * record (product, equipment…), so every group would hold a single record.
 */
export function groupableColumns(columns: TableColumn[]): TableColumn[] {
  return columns.slice(1).filter((column) => isOneOf(STATS_GROUP_TYPES, column));
}

export function summableColumns(columns: TableColumn[]): TableColumn[] {
  return columns.filter((column) => isOneOf(STATS_SUM_TYPES, column));
}

/** Lists group best (few, colored values), then yes/no, then free text. */
export function defaultGroupBy(columns: TableColumn[]): TableColumn | undefined {
  const groupable = groupableColumns(columns);
  return (["select", "boolean", "text"] as const)
    .map((type) => groupable.find((column) => column.type === type))
    .find(Boolean);
}
