import type { TableColumn, TableRecord } from "@tablaria/shared";

/**
 * Where a record's QR label leads: its table, with the record open (ADR-038).
 * Only people who can open the table see anything there; the code itself
 * holds no data.
 */
export function recordUrl(tableId: string, recordId: string): string {
  return `${window.location.origin}/app/tables/${tableId}?${new URLSearchParams({ record: recordId })}`;
}

/**
 * What a label prints under the code: the record's name (its first column)
 * and, when the table has one, its reference (the first unique column), the
 * code people read aloud: a SKU or a serial number.
 */
export function labelLines(
  columns: TableColumn[],
  record: TableRecord,
): { name: string; reference: string | null } {
  const [first] = columns;
  const reference = columns.find((column) => column.unique && column.id !== first?.id);
  const text = (column: TableColumn | undefined) => {
    const value = column ? record.data[column.id] : null;
    return value === null || value === undefined ? "" : String(value);
  };
  return { name: text(first), reference: text(reference) || null };
}
