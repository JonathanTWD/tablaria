import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { isXlsx, parseXlsx } from "./xlsx";

async function workbook(fill: (workbook: ExcelJS.Workbook) => void): Promise<ArrayBuffer> {
  const book = new ExcelJS.Workbook();
  fill(book);
  const buffer = await book.xlsx.writeBuffer();
  return buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer).buffer;
}

describe("parseXlsx", () => {
  it("reads the first sheet with data as the text a CSV would have", async () => {
    const buffer = await workbook((book) => {
      book.addWorksheet("Vacía");
      const sheet = book.addWorksheet("Productos");
      sheet.addRow(["Producto", "Precio", "Comprado", "Activo", "Total"]);
      sheet.addRow(["Taladro", 89.9, new Date("2026-03-14T00:00:00.000Z"), true, { formula: "B2*2", result: 179.8 }]);
      sheet.addRow([{ richText: [{ text: "Sierra " }, { text: "de calar" }] }, 74]);
    });

    expect(await parseXlsx(buffer)).toEqual([
      ["Producto", "Precio", "Comprado", "Activo", "Total"],
      // A formula gives its value, never the formula.
      ["Taladro", "89,9", "2026-03-14", "Sí", "179,8"],
      ["Sierra de calar", "74", "", "", ""],
    ]);
  });

  it("keeps a blank column in its place and skips blank rows", async () => {
    const buffer = await workbook((book) => {
      const sheet = book.addWorksheet("Hoja");
      sheet.getCell("A1").value = "Nombre";
      sheet.getCell("C1").value = "Stock";
      sheet.getCell("A3").value = "Martillo";
      sheet.getCell("C3").value = 12;
    });

    expect(await parseXlsx(buffer)).toEqual([
      ["Nombre", "", "Stock"],
      ["Martillo", "", "12"],
    ]);
  });

  it("tells workbooks from CSV files by name or type", () => {
    expect(isXlsx(new File([], "inventario.XLSX"))).toBe(true);
    expect(isXlsx(new File([], "inventario.csv", { type: "text/csv" }))).toBe(false);
  });
});
