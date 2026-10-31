import type { TableColumn, TableRecord } from "@tablaria/shared";

/**
 * A record's group, as the API names it (ADR-029): a select's label,
 * "true"/"false", the text itself, or the label of the linked record.
 */
export function groupValueOf(
  column: TableColumn,
  record: TableRecord,
  linked: Record<string, string>,
): string | null {
  const value = record.data[column.id];
  if (value === null || value === undefined) {
    return null;
  }
  if (column.type === "relation") {
    return linked[String(value)] ?? null;
  }
  return String(value);
}
