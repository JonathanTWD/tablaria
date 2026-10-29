import { z } from "zod";
import { MAX_COLUMNS_PER_TABLE, TEXT_VALUE_MAX_LENGTH } from "./column-types.js";

/** Rows per import; bigger files are split by whoever imports them. */
export const MAX_IMPORT_ROWS = 5000;
/** Errors listed per check: enough to fix a file, few enough to read. */
export const MAX_IMPORT_ERRORS = 50;

/**
 * A file already read in the browser (ADR-021): the server receives its cells
 * as text, never the file, and converts and validates each one itself.
 */
export const importSchema = z.object({
  /** For each column of the file, the table column it fills, or null to skip it. */
  columns: z
    .array(z.uuid().nullable())
    .min(1)
    .max(MAX_COLUMNS_PER_TABLE)
    .refine((ids) => ids.some((id) => id !== null), "No column is imported")
    .refine((ids) => {
      const used = ids.filter((id) => id !== null);
      return new Set(used).size === used.length;
    }, "A table column is used twice"),
  /** The data rows, without the header row. */
  rows: z
    .array(z.array(z.string().max(TEXT_VALUE_MAX_LENGTH)).max(MAX_COLUMNS_PER_TABLE))
    .min(1)
    .max(MAX_IMPORT_ROWS),
  /** Adds the values that no select choice matches as new choices (admins only). */
  addMissingChoices: z.boolean().default(false),
});
export type ImportInput = z.input<typeof importSchema>;

export interface ImportCellError {
  /** 1 is the first data row. */
  row: number;
  columnId: string;
  value: string;
  reason: "invalid" | "required" | "unknownChoice";
}

export interface ImportCheck {
  rows: number;
  validRows: number;
  errorCount: number;
  /** The first MAX_IMPORT_ERRORS errors. */
  errors: ImportCellError[];
  /** Values of select columns that match no choice, by column. */
  missingChoices: { columnId: string; values: string[] }[];
}

export interface ImportResult {
  imported: number;
  addedChoices: number;
}
