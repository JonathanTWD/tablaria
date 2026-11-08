import {
  type CellValue,
  linkedRecordIds,
  type RecordData,
  type TableColumn,
} from '@tablaria/shared';
import ExcelJS from 'exceljs';

/** Excel's limit for a sheet name, and the characters it refuses in one. */
const SHEET_NAME_MAX_LENGTH = 31;
const SHEET_NAME_FORBIDDEN = /[[\]:*?/\\]/g;
const MAX_COLUMN_WIDTH = 50;

/** "€", "$", "US$": the symbol Spanish formats use for a currency. */
function currencySymbol(code: string): string {
  return (
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: code })
      .formatToParts(0)
      .find(({ type }) => type === 'currency')?.value ?? code
  );
}

function currencyOf(column: TableColumn): string | null {
  return column.type === 'currency' || column.type === 'formula'
    ? (column.options.currency ?? null)
    : null;
}

/**
 * A cell as Excel keeps it: numbers and prices as numbers (with the currency
 * in the number format), dates as dates, Sí/No and linked records as text.
 * Text stays text: a value starting with "=" is never written as a formula.
 */
function cellValue(
  column: TableColumn,
  value: CellValue | undefined,
  linked: Record<string, string>,
): string | number | Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (column.type === 'relation') {
    return linkedRecordIds(value)
      .map((id) => linked[id] ?? '')
      .filter((label) => label !== '')
      .join(', ');
  }
  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No';
  }
  if (typeof value === 'number') {
    return value;
  }
  if (column.type === 'date' && typeof value === 'string') {
    // Midnight UTC: Excel shows the same day in every time zone.
    return new Date(`${value}T00:00:00.000Z`);
  }
  return String(value);
}

function numberFormat(column: TableColumn): string | undefined {
  const currency = currencyOf(column);
  if (currency) {
    return `#,##0.00 "${currencySymbol(currency).replaceAll('"', '')}"`;
  }
  if (column.type === 'date') {
    return 'dd/mm/yyyy';
  }
  return undefined;
}

/**
 * The records as an Excel workbook: one sheet named after the table, a bold
 * header row that stays on screen, a filter on every column and widths that
 * fit the content.
 */
export async function toXlsx(
  tableName: string,
  columns: TableColumn[],
  rows: RecordData[],
  linked: Record<string, string> = {},
  lookupTargets: ReadonlyMap<string, TableColumn> = new Map(),
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tablaria';
  const sheet = workbook.addWorksheet(
    tableName
      .replace(SHEET_NAME_FORBIDDEN, ' ')
      .trim()
      .slice(0, SHEET_NAME_MAX_LENGTH) || 'Tabla',
    { views: [{ state: 'frozen', ySplit: 1 }] },
  );

  // Lookups and rollups are formatted like the column they show.
  const shown = columns.map((column) => lookupTargets.get(column.id) ?? column);
  sheet.columns = columns.map((column, index) => {
    const currency = currencyOf(shown[index]);
    return {
      header: currency ? `${column.name} (${currency})` : column.name,
      key: column.id,
      style: { numFmt: numberFormat(shown[index]) },
    };
  });
  for (const row of rows) {
    sheet.addRow(
      columns.map((column, index) =>
        cellValue(shown[index], row[column.id], linked),
      ),
    );
  }

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle' };
  if (columns.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };
  }
  sheet.columns.forEach((excelColumn, index) => {
    const longest = Math.max(
      String(excelColumn.header ?? '').length,
      ...rows.slice(0, 200).map((row) => {
        const value = cellValue(shown[index], row[columns[index].id], linked);
        return value instanceof Date ? 10 : String(value ?? '').length;
      }),
    );
    excelColumn.width = Math.min(Math.max(longest + 2, 8), MAX_COLUMN_WIDTH);
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
