import {
  canBeUnique,
  COLUMN_TYPES,
  columnDefinitionSchema,
  ROLLUP_FUNCTIONS,
  type RollupFunction,
  columnNameSchema,
  SELECT_COLORS,
  type CellValue,
  type ColumnDefinition,
  type ColumnType,
  renameFormulaColumns,
  type SelectColor,
  type TableColumn,
} from "@tablaria/shared";
import { z } from "zod";

/**
 * Flat shape the form edits. Every type's settings live side by side, so
 * switching the type back and forth never loses what the user typed.
 */
export interface ColumnFormValues {
  name: string;
  type: ColumnType;
  required: boolean;
  /** Text and number columns: no two records may share a value. */
  unique: boolean;
  /** Number columns: changes are kept as stock movements. */
  stock: boolean;
  currency: string;
  /** Number columns: warn when a value drops below this. Empty for no warning. */
  alertBelow: string;
  /** Date columns: warn this many days before the date. Empty for no warning. */
  alertDaysBefore: string;
  choices: { id: string; label: string; color: SelectColor }[];
  /** Relation columns: the table they link to, and whether to several of its records. */
  tableId: string;
  multiple: boolean;
  /**
   * Lookups: the relation they read through and the column they show.
   * Rollups: the relation that links here and the column they sum up.
   */
  relationColumnId: string;
  targetColumnId: string;
  /** Rollup columns: how they sum up the linking records. */
  rollupFunction: RollupFunction;
  /** Formula columns: the expression, citing columns by name, and an optional currency. */
  expression: string;
  formulaCurrency: string;
  /** Typed text, "true"/"false" for booleans, or the choice id for selects. */
  defaultValue: string;
}

export function newChoice(index: number): ColumnFormValues["choices"][number] {
  return {
    id: crypto.randomUUID(),
    label: "",
    color: SELECT_COLORS[index % SELECT_COLORS.length],
  };
}

/**
 * Form values for a new column or for editing one. `columns` are the
 * table's, to show a formula with names instead of the ids it is stored with.
 */
export function columnFormDefaults(
  column?: TableColumn,
  columns: TableColumn[] = [],
): ColumnFormValues {
  const values: ColumnFormValues = {
    name: column?.name ?? "",
    type: column?.type ?? "text",
    required: column?.required ?? false,
    unique: column?.unique ?? false,
    stock: column?.stock ?? false,
    currency: "EUR",
    alertBelow: "",
    alertDaysBefore: "",
    choices: [newChoice(0)],
    tableId: "",
    multiple: false,
    relationColumnId: "",
    targetColumnId: "",
    rollupFunction: "count",
    expression: "",
    formulaCurrency: "",
    defaultValue: "",
  };
  if (!column) {
    return values;
  }
  if (column.type === "currency") {
    values.currency = column.options.currency;
  }
  if (column.type === "select") {
    values.choices = column.options.choices;
  }
  if (column.type === "relation") {
    values.tableId = column.options.tableId;
    values.multiple = column.options.multiple;
  }
  if (column.type === "lookup") {
    values.relationColumnId = column.options.relationColumnId;
    values.targetColumnId = column.options.targetColumnId;
  }
  if (column.type === "rollup") {
    values.relationColumnId = column.options.relationColumnId;
    values.targetColumnId = column.options.targetColumnId ?? "";
    values.rollupFunction = column.options.function;
  }
  if (column.type === "formula") {
    values.expression = renameFormulaColumns(
      column.options.expression,
      (ref) => columns.find(({ id }) => id === ref)?.name,
    );
    values.formulaCurrency = column.options.currency ?? "";
  }
  if (column.type === "number" && column.options) {
    values.alertBelow = String(column.options.alertBelow);
  }
  if (column.type === "date" && column.options) {
    values.alertDaysBefore = String(column.options.alertDaysBefore);
  }
  values.defaultValue =
    column.type === "select"
      ? (column.options.choices.find((choice) => choice.label === column.defaultValue)?.id ??
        "")
      : column.defaultValue === null
        ? ""
        : String(column.defaultValue);
  return values;
}

// NaN is rejected by the schema, which marks the field as invalid.
function parseNumber(text: string): number {
  return Number(text.replace(",", "."));
}

function parseDefault(values: ColumnFormValues): CellValue {
  const text = values.defaultValue.trim();
  if (text === "") {
    return null;
  }
  switch (values.type) {
    case "number":
    case "currency":
      return parseNumber(text);
    case "boolean":
      return text === "true";
    case "select":
      return values.choices.find((choice) => choice.id === text)?.label ?? null;
    default:
      return text;
  }
}

/** Unvalidated column definition built from the form values. */
function toDraft(values: ColumnFormValues) {
  // Kept while other types are tried, but only sent for types that allow them.
  // A stock column can't be unique: the form offers one or the other.
  const stock = values.stock && values.type === "number";
  const unique = values.unique && canBeUnique(values.type) && !stock;
  const base = {
    name: values.name,
    required: values.required,
    unique,
    stock,
    // Every record left empty would share the default, so unique columns have none.
    defaultValue: unique ? null : parseDefault(values),
  };
  switch (values.type) {
    case "select":
      return { ...base, type: "select", options: { choices: values.choices } };
    case "currency":
      return { ...base, type: "currency", options: { currency: values.currency } };
    case "relation":
      return {
        ...base,
        type: "relation",
        options: { tableId: values.tableId, multiple: values.multiple },
        defaultValue: null,
      };
    case "lookup":
      return {
        ...base,
        type: "lookup",
        required: false,
        options: { relationColumnId: values.relationColumnId, targetColumnId: values.targetColumnId },
        defaultValue: null,
      };
    case "rollup":
      return {
        ...base,
        type: "rollup",
        required: false,
        options: {
          relationColumnId: values.relationColumnId,
          function: values.rollupFunction,
          targetColumnId: values.rollupFunction === "count" ? null : values.targetColumnId,
        },
        defaultValue: null,
      };
    case "formula":
      return {
        ...base,
        type: "formula",
        required: false,
        unique: false,
        // The API cites columns by id and works out the result type.
        options: { expression: values.expression, currency: values.formulaCurrency || null },
        defaultValue: null,
      };
    case "number": {
      const alertBelow = values.alertBelow.trim();
      return {
        ...base,
        type: "number",
        options: alertBelow === "" ? null : { alertBelow: parseNumber(alertBelow) },
      };
    }
    case "date": {
      const alertDaysBefore = values.alertDaysBefore.trim();
      return {
        ...base,
        type: "date",
        options: alertDaysBefore === "" ? null : { alertDaysBefore: Number(alertDaysBefore) },
      };
    }
    default:
      return { ...base, type: values.type, options: null };
  }
}

/** API payload for form values that already passed `columnFormSchema`. */
export function toColumnDefinition(values: ColumnFormValues): ColumnDefinition {
  return columnDefinitionSchema.parse(toDraft(values));
}

/** API paths (`options.choices.0.label`) → form fields (`choices.0.label`). */
function toFormPath(path: PropertyKey[]): PropertyKey[] {
  return path[0] === "options" ? path.slice(1) : path;
}

/** Validates the form with the same rules the API applies to the column. */
export const columnFormSchema = z
  .object({
    // Checked in superRefine: a failing field here would skip the refinement and
    // hide the other errors until the name is fixed.
    name: z.string(),
    type: z.enum(COLUMN_TYPES),
    required: z.boolean(),
    unique: z.boolean(),
    stock: z.boolean(),
    currency: z.string(),
    alertBelow: z.string(),
    alertDaysBefore: z.string(),
    choices: z.array(
      z.object({ id: z.string(), label: z.string(), color: z.enum(SELECT_COLORS) }),
    ),
    tableId: z.string(),
    multiple: z.boolean(),
    relationColumnId: z.string(),
    targetColumnId: z.string(),
    rollupFunction: z.enum(ROLLUP_FUNCTIONS),
    expression: z.string(),
    formulaCurrency: z.string(),
    defaultValue: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!columnNameSchema.safeParse(values.name).success) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "Invalid name" });
    }
    const result = columnDefinitionSchema.safeParse(toDraft(values));
    for (const issue of result.error?.issues ?? []) {
      if (issue.path[0] !== "name") {
        ctx.addIssue({ code: "custom", path: toFormPath(issue.path), message: issue.message });
      }
    }
  });
