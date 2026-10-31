import { z } from "zod";
import {
  type CellValue,
  type ColumnDefinition,
  type ColumnType,
  columnValueSchemas,
} from "./column-types.js";

export const MAX_RECORDS_PER_TABLE = 10_000;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const SEARCH_MAX_LENGTH = 200;
export const MAX_FILTERS = 20;

/** Cell values keyed by column id. Empty cells are absent. */
export type RecordData = Record<string, CellValue>;

export interface TableRecord {
  id: string;
  data: RecordData;
  createdAt: string;
  updatedAt: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

/** Shape of every paginated list returned by the API. */
export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

/**
 * A page of records, with the label (first column) of each record they link
 * to. Records of tables the user can't open are left out: the UI shows the
 * link without saying what it is.
 */
/** Records sharing a value of the grouped column (ADR-029). */
export interface RecordGroup {
  /** The value as text: a select's label, "true"/"false", or a linked record's label. Null: empty. */
  value: string | null;
  /** Records in the group, with the search and filters applied. */
  count: number;
}

/** Columns a listing can be grouped by: values that repeat across records. */
export const GROUPABLE_COLUMN_TYPES = ["select", "boolean", "text", "relation"] as const;

export function canGroupRecordsBy(type: ColumnType): boolean {
  return (GROUPABLE_COLUMN_TYPES as readonly ColumnType[]).includes(type);
}

export interface RecordPage extends Paginated<TableRecord> {
  linked: Record<string, string>;
  /** Every group of the whole listing (not only this page) when it is grouped; empty otherwise. */
  groups: RecordGroup[];
  /**
   * Relation columns whose linked table the user can open: only these can be
   * searched, filtered and sorted by label (ADR-028).
   */
  labelledRelations: string[];
}

/** Any column with its id: what record validation needs from a table. */
export type RecordColumn = ColumnDefinition & { id: string };

const blankToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

/** Valid value (or null) for one column, including its select choices. */
export function cellValueSchema(column: ColumnDefinition): z.ZodType<CellValue> {
  const base: z.ZodType<CellValue> =
    column.type === "select"
      ? columnValueSchemas.select.refine(
          (label) => column.options.choices.some((choice) => choice.label === label),
          "Not one of the column's choices",
        )
      : columnValueSchemas[column.type];
  return z.preprocess(blankToNull, base.nullable());
}

/**
 * Validates record data against the table's columns: only known column ids,
 * values that fit each type, and required columns filled. When creating,
 * missing values take the column default; a partial update only checks the
 * cells it sends. Null means "empty the cell".
 */
export function recordDataSchema(columns: RecordColumn[], { partial }: { partial: boolean }) {
  const shape = Object.fromEntries(
    columns.map((column) => [column.id, cellValueSchema(column).optional()]),
  );
  return z
    .strictObject(shape)
    .transform((data) => {
      const result: Record<string, CellValue> = {};
      for (const column of columns) {
        const value = data[column.id];
        if (value !== undefined) {
          result[column.id] = value;
        } else if (!partial) {
          result[column.id] = column.defaultValue;
        }
      }
      return result;
    })
    .superRefine((data, ctx) => {
      for (const column of columns) {
        if (column.required && column.id in data && data[column.id] === null) {
          ctx.addIssue({ code: "custom", path: [column.id], message: "Required" });
        }
      }
    });
}

export const recordInputSchema = z.object({
  // Checked against the table's columns by `recordDataSchema`.
  data: z.record(z.string(), z.unknown()),
});

export type RecordInput = z.infer<typeof recordInputSchema>;

// Filters ----------------------------------------------------------------

export const FILTER_OPERATORS = ["contains", "between", "is", "in"] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

/** The single filter each column type supports. */
export const FILTER_OPERATOR_BY_TYPE: Record<ColumnType, FilterOperator> = {
  text: "contains",
  number: "between",
  currency: "between",
  date: "between",
  boolean: "is",
  select: "in",
  // By the linked record's label (ADR-028).
  relation: "contains",
};

const rangeBoundSchema = z.union([z.number(), z.iso.date()]);

export const recordFilterSchema = z.discriminatedUnion("op", [
  z.object({
    columnId: z.uuid(),
    op: z.literal("contains"),
    value: z.string().trim().min(1).max(SEARCH_MAX_LENGTH),
  }),
  z
    .object({
      columnId: z.uuid(),
      op: z.literal("between"),
      min: rangeBoundSchema.optional(),
      max: rangeBoundSchema.optional(),
    })
    .refine((filter) => filter.min !== undefined || filter.max !== undefined, "Empty range"),
  z.object({ columnId: z.uuid(), op: z.literal("is"), value: z.boolean() }),
  z.object({
    columnId: z.uuid(),
    op: z.literal("in"),
    values: z.array(z.string().min(1).max(100)).min(1).max(50),
  }),
]);

export type RecordFilter = z.infer<typeof recordFilterSchema>;

export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/** Query string of `GET /tables/:tableId/records`; `filters` is a JSON array. */
export const recordListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
  sort: z.uuid().optional(),
  order: z.enum(SORT_ORDERS).default("asc"),
  /** Column whose values group the records; they come group by group (ADR-029). */
  group: z.uuid().optional(),
  filters: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (raw === undefined || raw === "") {
        return [];
      }
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "filters must be a JSON array" });
        return z.NEVER;
      }
    })
    .pipe(z.array(recordFilterSchema).max(MAX_FILTERS)),
});

export type RecordListQuery = z.output<typeof recordListQuerySchema>;

export const RECORD_EXPORT_FORMATS = ["csv"] as const;
export type RecordExportFormat = (typeof RECORD_EXPORT_FORMATS)[number];

/** Same view as the listing (search, filters, sort) without pagination: every match is exported. */
export const recordExportQuerySchema = recordListQuerySchema
  .omit({ page: true, pageSize: true })
  .extend({ format: z.enum(RECORD_EXPORT_FORMATS).default("csv") });

export type RecordExportQuery = z.output<typeof recordExportQuerySchema>;
