export const COLUMN_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
  "select",
  "currency",
] as const;

export type ColumnType = (typeof COLUMN_TYPES)[number];
