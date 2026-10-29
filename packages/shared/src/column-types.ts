import { z } from "zod";

export const COLUMN_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
  "select",
  "currency",
  "relation",
] as const;

export type ColumnType = (typeof COLUMN_TYPES)[number];

export const MAX_COLUMNS_PER_TABLE = 50;
export const COLUMN_NAME_MAX_LENGTH = 60;
export const TEXT_VALUE_MAX_LENGTH = 2000;
export const MAX_SELECT_CHOICES = 50;
export const SELECT_CHOICE_MAX_LENGTH = 50;

export const SELECT_COLORS = [
  "gray",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "indigo",
  "purple",
  "pink",
] as const;

export type SelectColor = (typeof SELECT_COLORS)[number];

/** A stored cell value. Empty cells are absent (or null), never an empty string. */
export type CellValue = string | number | boolean | null;

/** Valid value for each column type, ignoring per-column settings such as select choices. */
export const columnValueSchemas = {
  text: z.string().trim().min(1).max(TEXT_VALUE_MAX_LENGTH),
  number: z.number(),
  date: z.iso.date(),
  boolean: z.boolean(),
  // Select cells store the choice label; it must also be one of the column's choices.
  select: z.string().trim().min(1).max(SELECT_CHOICE_MAX_LENGTH),
  currency: z.number(),
  // The id of a record in the linked table (ADR-022).
  relation: z.uuid(),
} satisfies Record<ColumnType, z.ZodType>;

const currencyCodes = new Set(Intl.supportedValuesOf("currency"));

export const currencyCodeSchema = z
  .string()
  .refine((code) => currencyCodes.has(code), "Unknown ISO 4217 currency code");

export const selectChoiceSchema = z.object({
  // Stable identity, so renaming a choice can carry its values along.
  id: z.string().min(1).max(64),
  label: columnValueSchemas.select,
  color: z.enum(SELECT_COLORS),
});

export type SelectChoice = z.infer<typeof selectChoiceSchema>;

export const selectOptionsSchema = z.object({
  choices: z
    .array(selectChoiceSchema)
    .min(1)
    .max(MAX_SELECT_CHOICES)
    .superRefine((choices, ctx) => {
      const ids = new Set<string>();
      const labels = new Set<string>();
      choices.forEach((choice, index) => {
        const label = choice.label.toLocaleLowerCase();
        if (ids.has(choice.id)) {
          ctx.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate choice id" });
        }
        if (labels.has(label)) {
          ctx.addIssue({ code: "custom", path: [index, "label"], message: "Duplicate choice" });
        }
        ids.add(choice.id);
        labels.add(label);
      });
    }),
});

export const currencyOptionsSchema = z.object({ currency: currencyCodeSchema });

/** Number columns can warn when a value falls below a threshold (e.g. stock). */
export const numberOptionsSchema = z.object({
  alertBelow: z.number().min(0).max(1_000_000_000),
});

/** A relation links each record to one record of another table of the same space. */
export const relationOptionsSchema = z.object({ tableId: z.uuid() });

export type SelectOptions = z.infer<typeof selectOptionsSchema>;
export type RelationOptions = z.infer<typeof relationOptionsSchema>;
export type CurrencyOptions = z.infer<typeof currencyOptionsSchema>;
export type NumberOptions = z.infer<typeof numberOptionsSchema>;

export const columnNameSchema = z.string().trim().min(1).max(COLUMN_NAME_MAX_LENGTH);

const columnBase = {
  name: columnNameSchema,
  required: z.boolean().default(false),
  /** No two records may hold the same value (SKU, serial number…); ADR-023. */
  unique: z.boolean().default(false),
};

/** Types whose values identify a record: unique columns are one of these. */
export const UNIQUE_COLUMN_TYPES = ["text", "number"] as const satisfies readonly ColumnType[];

export function canBeUnique(type: ColumnType): boolean {
  return (UNIQUE_COLUMN_TYPES as readonly ColumnType[]).includes(type);
}

/** Types without settings of their own. */
function plainColumn<T extends ColumnType, V extends z.ZodType<CellValue>>(type: T, value: V) {
  return z.object({
    ...columnBase,
    type: z.literal(type),
    options: z.null().default(null),
    defaultValue: value.nullable().default(null),
  });
}

/** Everything that defines a column except its identity and position. */
export const columnDefinitionSchema = z
  .discriminatedUnion("type", [
    plainColumn("text", columnValueSchemas.text),
    z.object({
      ...columnBase,
      type: z.literal("number"),
      options: numberOptionsSchema.nullable().default(null),
      defaultValue: columnValueSchemas.number.nullable().default(null),
    }),
    plainColumn("date", columnValueSchemas.date),
    plainColumn("boolean", columnValueSchemas.boolean),
    z.object({
      ...columnBase,
      type: z.literal("select"),
      options: selectOptionsSchema,
      defaultValue: columnValueSchemas.select.nullable().default(null),
    }),
    z.object({
      ...columnBase,
      type: z.literal("currency"),
      options: currencyOptionsSchema,
      defaultValue: columnValueSchemas.currency.nullable().default(null),
    }),
    z.object({
      ...columnBase,
      type: z.literal("relation"),
      options: relationOptionsSchema,
      // A default record would link every new record to the same one: never useful.
      defaultValue: z.null().default(null),
    }),
  ])
  .superRefine((column, ctx) => {
    if (column.unique && !canBeUnique(column.type)) {
      ctx.addIssue({ code: "custom", path: ["unique"], message: "Only text and numbers can be unique" });
    }
    // Every record that leaves the cell empty would share the default.
    if (column.unique && column.defaultValue !== null) {
      ctx.addIssue({ code: "custom", path: ["defaultValue"], message: "A unique column has no default value" });
    }
    if (
      column.type === "select" &&
      column.defaultValue !== null &&
      !column.options.choices.some((choice) => choice.label === column.defaultValue)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultValue"],
        message: "Default value must be one of the choices",
      });
    }
  });

export type ColumnDefinitionInput = z.input<typeof columnDefinitionSchema>;
export type ColumnDefinition = z.output<typeof columnDefinitionSchema>;

/**
 * Partial change to a column. The API merges it into the stored column and
 * validates the result with `columnDefinitionSchema`; when the type changes,
 * options and default value are reset unless they are sent too.
 */
export const updateColumnSchema = z
  .object({
    name: columnNameSchema,
    required: z.boolean(),
    unique: z.boolean(),
    type: z.enum(COLUMN_TYPES),
    options: z.unknown(),
    defaultValue: z.unknown(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "Nothing to update");

export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;

export const reorderColumnsSchema = z.object({
  columnIds: z
    .array(z.uuid())
    .min(1)
    .max(MAX_COLUMNS_PER_TABLE)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate column id"),
});

export type ReorderColumnsInput = z.infer<typeof reorderColumnsSchema>;

export type TableColumn = ColumnDefinition & {
  id: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export interface UpdateColumnResponse {
  column: TableColumn;
  /** Cells emptied because their value could not be converted or no longer fits. */
  clearedValues: number;
}

export type StockLevel = "ok" | "low" | "out";

/**
 * Where a value stands against an alert threshold: below it is "low", or
 * "out" at 0 or less. Matches the comparison the API runs for the alerts.
 */
export function stockLevelFor(value: number, alertBelow: number): StockLevel {
  if (value >= alertBelow) {
    return "ok";
  }
  return value <= 0 ? "out" : "low";
}

/** A cell's stock level, or null when its column sets no threshold. */
export function stockLevel(
  column: ColumnDefinition,
  value: CellValue | undefined,
): StockLevel | null {
  if (column.type !== "number" || !column.options || typeof value !== "number") {
    return null;
  }
  return stockLevelFor(value, column.options.alertBelow);
}
