import type { CellValue, ColumnDefinition } from "@tablaria/shared";

/**
 * Text the user edits for a cell: numbers as typed, "true"/"false" for
 * booleans, ISO dates, select labels. "" means empty.
 */
export function toDraft(value: CellValue | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * The value a draft stands for, before validation: blanks become null and
 * numbers accept a decimal comma. Invalid numbers become NaN, which the
 * column schema rejects.
 */
export function fromDraft(column: ColumnDefinition, draft: string): unknown {
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
    default:
      return text;
  }
}
