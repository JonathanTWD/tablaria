import { z } from "zod";

export const COLUMN_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
  "select",
  "currency",
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

export type SelectOptions = z.infer<typeof selectOptionsSchema>;
export type CurrencyOptions = z.infer<typeof currencyOptionsSchema>;

export const columnNameSchema = z.string().trim().min(1).max(COLUMN_NAME_MAX_LENGTH);

const columnBase = {
  name: columnNameSchema,
  required: z.boolean().default(false),
};

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
    plainColumn("number", columnValueSchemas.number),
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
  ])
  .superRefine((column, ctx) => {
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
