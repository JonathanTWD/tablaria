import { z } from "zod";
import {
  columnDefinitionSchema,
  MAX_COLUMNS_PER_TABLE,
  TEXT_VALUE_MAX_LENGTH,
} from "./column-types.js";
import { tableNameSchema } from "./tables.js";

/** Rows per import; bigger files are split by whoever imports them. */
export const MAX_IMPORT_ROWS = 5000;
/** Errors listed per check: enough to fix a file, few enough to read. */
export const MAX_IMPORT_ERRORS = 50;

/**
 * Where a column of the file goes: an existing table column (its id), a new
 * column created with the import, or nowhere (null).
 */
export const importTargetSchema = z.union([
  z.uuid(),
  z.object({ create: columnDefinitionSchema }),
  z.null(),
]);
export type ImportTarget = z.input<typeof importTargetSchema>;

const rowsSchema = z
  .array(z.array(z.string().max(TEXT_VALUE_MAX_LENGTH)).max(MAX_COLUMNS_PER_TABLE))
  .min(1)
  .max(MAX_IMPORT_ROWS);

/**
 * A file already read in the browser (ADR-021): the server receives its cells
 * as text, never the file, and converts and validates each one itself.
 */
export const importSchema = z.object({
  /** One entry per column of the file. */
  columns: z
    .array(importTargetSchema)
    .min(1)
    .max(MAX_COLUMNS_PER_TABLE)
    .refine((targets) => targets.some((target) => target !== null), "No column is imported")
    .refine((targets) => {
      const ids = targets.filter((target) => typeof target === "string");
      return new Set(ids).size === ids.length;
    }, "A table column is used twice"),
  /** The data rows, without the header row. */
  rows: rowsSchema,
  /** Adds the values that no select choice matches as new choices (admins only). */
  addMissingChoices: z.boolean().default(false),
  /**
   * Position of a file column mapped to a unique table column: rows whose
   * value matches a record update it instead of adding a new one (ADR-023).
   */
  updateBy: z.number().int().min(0).max(MAX_COLUMNS_PER_TABLE - 1).optional(),
});
export type ImportInput = z.input<typeof importSchema>;

/** A new table made from a file: every imported column is created with it. */
export const importNewTableSchema = importSchema.omit({ updateBy: true }).extend({
  name: tableNameSchema,
  columns: importSchema.shape.columns.refine(
    (targets) => targets.every((target) => typeof target !== "string"),
    "A new table has no columns to reuse",
  ),
});
export type ImportNewTableInput = z.input<typeof importNewTableSchema>;

export interface ImportCellError {
  /** 1 is the first data row. */
  row: number;
  /** Position of the column in the file, from 0. */
  column: number;
  value: string;
  reason: "invalid" | "required" | "unknownChoice" | "duplicate";
}

export interface ImportCheck {
  rows: number;
  validRows: number;
  /** Valid rows that update an existing record (with `updateBy`). */
  toUpdate: number;
  errorCount: number;
  /** The first MAX_IMPORT_ERRORS errors. */
  errors: ImportCellError[];
  /** Values of select columns that match no choice, by column of the file. */
  missingChoices: { column: number; values: string[] }[];
  /** Table columns that are required but get no column of the file. */
  missingRequired: string[];
}

export interface ImportResult {
  tableId: string;
  /** Records added. */
  imported: number;
  /** Records updated through `updateBy`. */
  updated: number;
  addedChoices: number;
  addedColumns: number;
}
