import {
  COLUMN_NAME_MAX_LENGTH,
  COLUMN_TYPES,
  type ColumnDefinitionInput,
  type ColumnType,
  MAX_SELECT_CHOICES,
  SELECT_CHOICE_MAX_LENGTH,
  SELECT_COLORS,
} from "@tablaria/shared";

/** What an import can create: relations need a linked table, which no file names. */
export type ImportableType = Exclude<ColumnType, "relation" | "lookup">;

export const IMPORTABLE_TYPES = COLUMN_TYPES.filter(
  (type): type is ImportableType => type !== "relation" && type !== "lookup",
);

/** Most distinct values a column can have to be offered as a list of options. */
const MAX_INFERRED_CHOICES = 12;
const YES_NO = new Set(["sí", "si", "no", "true", "false", "yes", "verdadero", "falso"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MONTH_YEAR = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/;
const CURRENCY_SYMBOLS: Record<string, string> = { "€": "EUR", $: "USD", "£": "GBP" };
/** "Precio (EUR)": the code our export adds to currency headers. */
const HEADER_CURRENCY = /\s*\(([A-Z]{3})\)\s*$/;

/**
 * A plain decimal number as spreadsheets write it ("1.234,56", "12,5 €"),
 * with the same rules as the API's import, or null.
 */
function parseNumber(text: string): number | null {
  let number = text.replace(/[\s€$£]/g, "");
  const comma = number.lastIndexOf(",");
  const dot = number.lastIndexOf(".");
  if (comma !== -1 && dot !== -1) {
    const [thousands, decimal] = comma > dot ? [/\./g, ","] : [/,/g, "."];
    number = number.replace(thousands, "").replace(decimal, ".");
  } else if (comma !== -1) {
    number = number.indexOf(",") === comma ? number.replace(",", ".") : number.replaceAll(",", "");
  } else if (dot !== -1 && number.indexOf(".") !== dot) {
    number = number.replaceAll(".", "");
  }
  return /^[-+]?\d+(?:\.\d+)?$/.test(number) ? Number(number) : null;
}

/** Distinct values, first spelling first, ignoring case. */
function distinct(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/** The type the values of a column of the file fit best. */
export function inferType(header: string, values: string[]): ImportableType {
  const filled = values.map((value) => value.trim()).filter((value) => value !== "");
  if (filled.length === 0) {
    return "text";
  }
  if (filled.every((value) => YES_NO.has(value.toLocaleLowerCase()))) {
    return "boolean";
  }
  if (filled.every((value) => parseNumber(value) !== null)) {
    const symbol = filled.some((value) => /[€$£]/.test(value));
    return symbol || HEADER_CURRENCY.test(header) ? "currency" : "number";
  }
  if (filled.every((value) => ISO_DATE.test(value) || DAY_MONTH_YEAR.test(value))) {
    return "date";
  }
  const options = distinct(filled);
  // A few values that repeat (Disponible, Agotado…) are a list; names and notes are text.
  const isList =
    options.length <= MAX_INFERRED_CHOICES &&
    filled.length >= options.length * 2 &&
    options.every((value) => value.length <= SELECT_CHOICE_MAX_LENGTH);
  return isList ? "select" : "text";
}

/**
 * A new column of `type` for a column of the file: its name from the header
 * (unique among `takenNames`), and the settings the type needs from the values.
 */
export function columnForFile(
  type: ImportableType,
  header: string,
  values: string[],
  takenNames: string[],
  emptyChoiceLabel: string,
): ColumnDefinitionInput {
  const name = uniqueName(header.replace(HEADER_CURRENCY, "").trim(), takenNames);
  switch (type) {
    case "currency":
      return { name, type, options: { currency: currencyOf(header, values) } };
    case "select": {
      const labels = distinct(
        values.map((value) => value.trim()).filter((value) => value !== ""),
      )
        .filter((label) => label.length <= SELECT_CHOICE_MAX_LENGTH)
        .slice(0, MAX_SELECT_CHOICES);
      const choices = (labels.length > 0 ? labels : [emptyChoiceLabel]).map((label, index) => ({
        id: `choice-${index + 1}`,
        label,
        color: SELECT_COLORS[index % SELECT_COLORS.length],
      }));
      return { name, type, options: { choices } };
    }
    default:
      return { name, type };
  }
}

function currencyOf(header: string, values: string[]): string {
  const code = HEADER_CURRENCY.exec(header)?.[1];
  if (code) {
    return code;
  }
  const symbol = values.join("").match(/[€$£]/)?.[0];
  return symbol ? CURRENCY_SYMBOLS[symbol] : "EUR";
}

/** "Precio", or "Precio 2" when a column already has that name. */
function uniqueName(base: string, takenNames: string[]): string {
  const taken = new Set(takenNames.map((name) => name.toLocaleLowerCase()));
  const root = base.slice(0, COLUMN_NAME_MAX_LENGTH - 3);
  let name = base.slice(0, COLUMN_NAME_MAX_LENGTH);
  for (let suffix = 2; taken.has(name.toLocaleLowerCase()); suffix++) {
    name = `${root} ${suffix}`;
  }
  return name;
}
