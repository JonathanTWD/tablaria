import type { CellValue as ExcelCellValue } from "exceljs";

/**
 * A cell as the text the import wizard reads, the same as in a CSV: numbers
 * with a decimal comma, dates in ISO format and Sí/No for true and false.
 */
function cellText(value: ExcelCellValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    return String(value).replace(".", ",");
  }
  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }
  if (value instanceof Date) {
    // Excel dates are days without a time zone; ExcelJS gives them at UTC midnight.
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    return value;
  }
  if ("richText" in value) {
    return value.richText.map(({ text }) => text).join("");
  }
  // A formula's value, never the formula itself: only what the sheet showed.
  if ("result" in value) {
    return value.result === undefined ? "" : cellText(value.result as ExcelCellValue);
  }
  if ("text" in value && typeof value.text === "string") {
    return value.text;
  }
  // Errors (#N/A, #DIV/0!) and anything else count as empty.
  return "";
}

/**
 * The first sheet with data of an Excel workbook, as rows of text. ExcelJS is
 * loaded only now: most people never import a workbook, and it is large.
 */
export async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets.find((candidate) => candidate.actualRowCount > 0);
  if (!sheet) {
    return [];
  }
  // The rightmost column used, so a blank column in between keeps its place.
  const width = sheet.columnCount;
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    rows.push(Array.from({ length: width }, (_, index) => cellText(row.getCell(index + 1).value).trim()));
  });
  return rows;
}

export function isXlsx(file: File): boolean {
  return (
    /\.xlsx$/i.test(file.name) ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}
