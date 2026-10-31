import type { CellValue, ColumnDefinition } from "@tablaria/shared";

// Record ids are uuids: they never hold one.
const ID_SEPARATOR = ",";

/**
 * Text the user edits for a cell: numbers as typed, "true"/"false" for
 * booleans, ISO dates, select labels, and the linked record ids of a
 * multiple relation, comma-separated. "" means empty.
 */
export function toDraft(value: CellValue | undefined): string {
  if (Array.isArray(value)) {
    return value.join(ID_SEPARATOR);
  }
  return value === null || value === undefined ? "" : String(value);
}

/**
 * The value a draft stands for, before validation: blanks become null and
 * numbers accept a decimal comma. Invalid numbers become NaN, which the
 * column schema rejects.
 */
export function fromDraft(column: ColumnDefinition, draft: string): CellValue {
  const text = draft.trim();
  if (text === "") {
    return null;
  }
  switch (column.type) {
    case "number":
    case "currency":
      return Number(text.replace(",", "."));
    case "boolean":
      return text === "true";
    case "relation":
      return column.options.multiple ? text.split(ID_SEPARATOR) : text;
    default:
      return text;
  }
}
