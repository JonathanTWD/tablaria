import {
  COLUMN_TYPES,
  columnDefinitionSchema,
  columnNameSchema,
  SELECT_COLORS,
  type CellValue,
  type ColumnDefinition,
  type ColumnType,
  type SelectColor,
  type TableColumn,
} from "@wisedata/shared";
import { z } from "zod";

/**
 * Flat shape the form edits. Every type's settings live side by side, so
 * switching the type back and forth never loses what the user typed.
 */
export interface ColumnFormValues {
  name: string;
  type: ColumnType;
  required: boolean;
  currency: string;
  /** Number columns: warn when a value drops below this. Empty for no warning. */
  alertBelow: string;
  choices: { id: string; label: string; color: SelectColor }[];
  /** Relation columns: the table they link to. */
  tableId: string;
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

export function columnFormDefaults(column?: TableColumn): ColumnFormValues {
  const values: ColumnFormValues = {
    name: column?.name ?? "",
    type: column?.type ?? "text",
    required: column?.required ?? false,
    currency: "EUR",
    alertBelow: "",
    choices: [newChoice(0)],
    tableId: "",
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
  }
  if (column.type === "number" && column.options) {
    values.alertBelow = String(column.options.alertBelow);
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
  const base = {
    name: values.name,
    required: values.required,
    defaultValue: parseDefault(values),
  };
  switch (values.type) {
    case "select":
      return { ...base, type: "select", options: { choices: values.choices } };
    case "currency":
      return { ...base, type: "currency", options: { currency: values.currency } };
    case "relation":
      return { ...base, type: "relation", options: { tableId: values.tableId }, defaultValue: null };
    case "number": {
      const alertBelow = values.alertBelow.trim();
      return {
        ...base,
        type: "number",
        options: alertBelow === "" ? null : { alertBelow: parseNumber(alertBelow) },
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
    currency: z.string(),
    alertBelow: z.string(),
    choices: z.array(
      z.object({ id: z.string(), label: z.string(), color: z.enum(SELECT_COLORS) }),
    ),
    tableId: z.string(),
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
