import {
  type CellValue,
  type ColumnDefinition,
  columnValueSchemas,
} from '@tablaria/shared';
import { convertCellValue } from '../columns/convert-value';
import { uniqueKey } from '../records/unique-values';

export type ImportedCell =
  | { value: CellValue }
  | {
      error: 'invalid' | 'unknownChoice' | 'unknownRecord' | 'ambiguousRecord';
    };

/** The records of a linked table by name (their first cell, as a unique key). */
export type RecordsByName = ReadonlyMap<string, string[]>;

// Our CSV export prefixes these with an apostrophe so spreadsheets keep them as text.
const FORMULA_GUARD = /^'(?=[=+\-@\t\r])/;
// \s also covers the no-break spaces spreadsheets put in numbers.
const SPACES_AND_SYMBOLS = /[\s€$£]/g;
const PLAIN_NUMBER = /^[-+]?\d+(?:\.\d+)?$/;
const DAY_MONTH_YEAR = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

/**
 * The value a cell of an imported file stands for in `column`. Blank cells are
 * empty; text that fits no value of the type is an error, never a silent null.
 */
export function importCellValue(
  text: string,
  column: ColumnDefinition,
): ImportedCell {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { value: null };
  }
  let value: CellValue;
  switch (column.type) {
    case 'number':
    case 'currency': {
      const number = normalizeNumber(trimmed);
      value = number === null ? null : Number(number);
      break;
    }
    case 'date':
      value = normalizeDate(trimmed);
      break;
    case 'text':
      value = convertCellValue(trimmed.replace(FORMULA_GUARD, ''), column);
      break;
    default:
      value = convertCellValue(trimmed, column);
  }
  if (value === null) {
    return { error: column.type === 'select' ? 'unknownChoice' : 'invalid' };
  }
  return { value };
}

/**
 * A relation cell names the record it links to, as the table shows it (its
 * first column), or several, comma-separated, when the relation is multiple:
 * what our CSV export writes (ADR-036). Names compare like unique values,
 * ignoring case and surrounding spaces.
 */
export function importLinkedRecords(
  text: string,
  multiple: boolean,
  names: RecordsByName,
): ImportedCell {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { value: null };
  }
  const parts = multiple
    ? trimmed.split(',').filter((part) => part.trim() !== '')
    : [trimmed];
  const ids: string[] = [];
  for (const part of parts) {
    const found = names.get(uniqueKey(part) ?? '') ?? [];
    if (found.length === 0) {
      return { error: 'unknownRecord' };
    }
    if (found.length > 1) {
      return { error: 'ambiguousRecord' };
    }
    if (!ids.includes(found[0])) {
      ids.push(found[0]);
    }
  }
  return { value: multiple ? ids : ids[0] };
}

/**
 * "1.234,56", "1,234.56", "12,5 €" and "-3" as a plain decimal string. With a
 * single separator it is the decimal one, as spreadsheets and our export write.
 */
function normalizeNumber(text: string): string | null {
  let number = text.replace(SPACES_AND_SYMBOLS, '');
  const comma = number.lastIndexOf(',');
  const dot = number.lastIndexOf('.');
  if (comma !== -1 && dot !== -1) {
    // Both: the last one is the decimal mark, the other groups thousands.
    const [thousands, decimal] = comma > dot ? [/\./g, ','] : [/,/g, '.'];
    number = number.replace(thousands, '').replace(decimal, '.');
  } else if (comma !== -1) {
    number =
      number.indexOf(',') === comma
        ? number.replace(',', '.')
        : number.replaceAll(',', '');
  } else if (dot !== -1 && number.indexOf('.') !== dot) {
    number = number.replaceAll('.', '');
  }
  return PLAIN_NUMBER.test(number) ? number : null;
}

/** ISO dates as they are, and day/month/year as Spanish spreadsheets write them. */
function normalizeDate(text: string): string | null {
  const match = DAY_MONTH_YEAR.exec(text);
  const iso = match
    ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
    : text;
  return columnValueSchemas.date.safeParse(iso).success ? iso : null;
}
