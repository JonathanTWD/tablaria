import {
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

export type DemoCellValue = string | number;
export type DemoRow = Record<string, DemoCellValue>;
export type DemoColumnType = "text" | "select" | "number" | "currency" | "date";

export interface DemoColumn {
  id: string;
  label: string;
  type: string;
  /** Number column that represents stock: shows "low" / "out of stock" states. */
  stock?: boolean;
  /** Hidden when the table is narrow, instead of scrolling sideways. */
  secondary?: boolean;
}

export interface DemoDataset {
  name: string;
  lowStock: number;
  columns: DemoColumn[];
  rows: DemoRow[];
}

const COLUMN_TYPES: readonly DemoColumnType[] = ["text", "select", "number", "currency", "date"];

export function columnType(column: DemoColumn): DemoColumnType {
  return COLUMN_TYPES.find((type) => type === column.type) ?? "text";
}

// Defined once, outside components, as TanStack Table recommends.
export const demoTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
  filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
});
