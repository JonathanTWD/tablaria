import {
  type CellValue,
  type ColumnDefinition,
  columnValueSchemas,
  TEXT_VALUE_MAX_LENGTH,
} from '@tablaria/shared';

const TRUE_WORDS = new Set(['true', 'sí', 'si', 'yes', '1', 'x']);
const FALSE_WORDS = new Set(['false', 'no', '0']);
const NUMBER_PATTERN = /^[-+]?\d+(?:[.,]\d+)?$/;

/**
 * Converts a stored cell value to the type of `target`. Returns null when the
 * value has no sensible equivalent, which empties the cell.
 */
export function convertCellValue(
  value: unknown,
  target: ColumnDefinition,
): CellValue {
  switch (target.type) {
    case 'text':
      return toText(value);
    case 'number':
    case 'currency':
      return toNumber(value);
    case 'date':
      return columnValueSchemas.date.safeParse(value).success
        ? (value as string)
        : null;
    case 'boolean':
      return toBoolean(value);
    case 'select': {
      const text = toText(value)?.toLocaleLowerCase();
      const choice = target.options.choices.find(
        ({ label }) => label.toLocaleLowerCase() === text,
      );
      return choice?.label ?? null;
    }
    case 'relation':
      // Nothing else names a record of the linked table.
      return null;
    case 'lookup':
    case 'rollup':
      // Never stored: computed when read (ADR-030, ADR-031).
      return null;
  }
}

function toText(value: unknown): string | null {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.trim().slice(0, TEXT_VALUE_MAX_LENGTH);
  return text === '' ? null : text;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.trim();
  return NUMBER_PATTERN.test(text) ? Number(text.replace(',', '.')) : null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  const word = toText(value)?.toLocaleLowerCase();
  if (word === undefined) {
    return null;
  }
  if (TRUE_WORDS.has(word)) {
    return true;
  }
  return FALSE_WORDS.has(word) ? false : null;
}
