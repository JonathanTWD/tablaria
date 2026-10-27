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
  choices: { id: string; label: string; color: SelectColor }[];
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
    choices: [newChoice(0)],
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
  values.defaultValue =
    column.type === "select"
      ? (column.options.choices.find((choice) => choice.label === column.defaultValue)?.id ??
        "")
      : column.defaultValue === null
        ? ""
        : String(column.defaultValue);
  return values;
}

function parseDefault(values: ColumnFormValues): CellValue {
  const text = values.defaultValue.trim();
  if (text === "") {
    return null;
  }
  switch (values.type) {
    case "number":
    case "currency":
      // NaN is rejected by the schema, which marks the field as invalid.
      return Number(text.replace(",", "."));
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
  if (path[0] !== "options") {
    return path;
  }
  return path[1] === "currency" ? ["currency"] : path.slice(1);
}

/** Validates the form with the same rules the API applies to the column. */
export const columnFormSchema = z
  .object({
    name: columnNameSchema,
    type: z.enum(COLUMN_TYPES),
    required: z.boolean(),
    currency: z.string(),
    choices: z.array(
      z.object({ id: z.string(), label: z.string(), color: z.enum(SELECT_COLORS) }),
    ),
    defaultValue: z.string(),
  })
  .superRefine((values, ctx) => {
    const result = columnDefinitionSchema.safeParse(toDraft(values));
    for (const issue of result.error?.issues ?? []) {
      if (issue.path[0] !== "name") {
        ctx.addIssue({ code: "custom", path: toFormPath(issue.path), message: issue.message });
      }
    }
  });
