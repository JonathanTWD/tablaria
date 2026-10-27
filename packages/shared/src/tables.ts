import { z } from "zod";
import type { TableColumn } from "./column-types.js";
import { TABLE_TEMPLATE_IDS } from "./templates.js";

export const MAX_TABLES_PER_USER = 100;
export const TABLE_NAME_MAX_LENGTH = 80;
export const TABLE_DESCRIPTION_MAX_LENGTH = 500;

export const tableNameSchema = z.string().trim().min(1).max(TABLE_NAME_MAX_LENGTH);

/** Blank descriptions are stored as null. */
export const tableDescriptionSchema = z
  .string()
  .trim()
  .max(TABLE_DESCRIPTION_MAX_LENGTH)
  .nullable()
  .transform((description) => description || null);

export const createTableSchema = z.object({
  name: tableNameSchema,
  description: tableDescriptionSchema.optional(),
  templateId: z.enum(TABLE_TEMPLATE_IDS).optional(),
});

export const updateTableSchema = z
  .object({
    name: tableNameSchema,
    description: tableDescriptionSchema,
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "Nothing to update");

export type CreateTableInput = z.input<typeof createTableSchema>;
export type UpdateTableInput = z.input<typeof updateTableSchema>;

export interface TableSummary {
  id: string;
  name: string;
  description: string | null;
  columnCount: number;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TableDetail extends TableSummary {
  /** Ordered by position. */
  columns: TableColumn[];
}
