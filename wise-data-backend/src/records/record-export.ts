import type { CellValue, RecordData, TableColumn } from '@wisedata/shared';

// Tells Excel the file is UTF-8, so accents and € display correctly.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

// Excel in Spanish (and most European locales) splits CSV columns on ';' and
// reads ',' as the decimal mark, so the file opens correctly with a double click.
const SEPARATOR = ';';

// Spreadsheets run cells that start with these as formulas ("CSV injection").
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

/** Text a spreadsheet will show as text: user content never becomes a formula. */
function neutralize(text: string): string {
  return FORMULA_TRIGGERS.test(text) ? `'${text}` : text;
}

function csvField(text: string): string {
  return /[";\r\n]|^\s|\s$/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

/**
 * A cell as CSV text: numbers with a decimal comma and no symbol (the
 * currency is in the header), booleans as Sí/No and dates in ISO format.
 */
function cellText(column: TableColumn, value: CellValue | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (column.type === 'boolean') {
    return value ? 'Sí' : 'No';
  }
  if (typeof value === 'number') {
    return String(value).replace('.', ',');
  }
  return neutralize(String(value));
}

function headerText(column: TableColumn): string {
  const name = neutralize(column.name);
  return column.type === 'currency'
    ? `${name} (${column.options.currency})`
    : name;
}

/**
 * CSV quoted as in RFC 4180 but separated by ';', with a header row of column
 * names and a byte order mark.
 */
export function toCsv(columns: TableColumn[], rows: RecordData[]): string {
  const lines = [
    columns.map((column) => csvField(headerText(column))),
    ...rows.map((row) =>
      columns.map((column) => csvField(cellText(column, row[column.id]))),
    ),
  ];
  const body = lines.map((fields) => fields.join(SEPARATOR)).join('\r\n');
  return `${BYTE_ORDER_MARK}${body}\r\n`;
}

/** ASCII file name from the table name, e.g. "ferreteria-lopez-2026-10-28.csv". */
export function exportFileName(
  tableName: string,
  extension: string,
  now = new Date(),
): string {
  const slug =
    tableName
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'tabla';
  return `${slug}-${now.toISOString().slice(0, 10)}.${extension}`;
}
