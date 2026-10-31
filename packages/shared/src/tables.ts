import { z } from "zod";
import type { TableColumn } from "./column-types.js";
import type { TableRole } from "./sharing.js";
import { TABLE_TEMPLATE_IDS } from "./templates.js";

/** Per space: the personal one or each organization. */
export const MAX_TABLES_PER_SPACE = 100;
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
  /** The current user's role, which decides what the interface lets them do. */
  role: TableRole;
}

export interface TableDetail extends TableSummary {
  organizationId: string;
  /** Whether the user belongs to its organization; otherwise it was shared with them. */
  member: boolean;
  /** Ordered by position. */
  columns: TableColumn[];
  /**
   * For each lookup whose linked table the user can open, the column it
   * shows (to format its values). Others show nothing (ADR-030).
   */
  lookupTargets: Record<string, TableColumn>;
}
