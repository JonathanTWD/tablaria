import type { TableColumn, TableDetail } from "@tablaria/shared";

/**
 * The column whose type and settings format a cell: what a lookup shows, what
 * a rollup sums up (a plain number when it counts), or the column itself.
 */
export function shownColumn(table: TableDetail, column: TableColumn): TableColumn {
  if (column.type === "lookup") {
    return table.lookupTargets[column.id] ?? column;
  }
  if (column.type === "rollup") {
    const target = table.rollupTargets[column.id];
    // A low-stock threshold is per record: it means nothing for a sum or an average.
    return target?.type === "currency" || target?.type === "date"
      ? target
      : { ...column, type: "number", stock: false, options: null, defaultValue: null };
  }
  return column;
}
