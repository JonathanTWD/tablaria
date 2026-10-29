import { describe, expect, it } from "vitest";
import { decodeText, detectSeparator, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("reads the semicolon files that Spanish Excel and our export write", () => {
    const text = '﻿Producto;Precio (EUR)\r\nTaladro;89,9\r\n"Caja; grande";"1,5"\r\n';

    expect(parseCsv(text)).toEqual([
      ["Producto", "Precio (EUR)"],
      ["Taladro", "89,9"],
      ["Caja; grande", "1,5"],
    ]);
  });

  it("keeps quotes, line breaks and empty cells inside fields", () => {
    const text = 'name,notes,stock\n"Llave ""inglesa""","línea 1\nlínea 2",\n\n';

    expect(parseCsv(text)).toEqual([
      ["name", "notes", "stock"],
      ['Llave "inglesa"', "línea 1\nlínea 2", ""],
    ]);
  });

  it("detects the separator from the first line, ignoring quoted text", () => {
    expect(detectSeparator("a;b;c\n1;2;3")).toBe(";");
    expect(detectSeparator('"x;y",b,c\n1,2,3')).toBe(",");
    expect(detectSeparator("a\tb\n1\t2")).toBe("\t");
  });
});

describe("decodeText", () => {
  it("reads UTF-8, and Windows-1252 when the bytes are not UTF-8", () => {
    expect(decodeText(new TextEncoder().encode("Revisión").buffer)).toBe("Revisión");
    // "Revisión" as Windows-1252: ó is the single byte 0xF3.
    const latin = new Uint8Array([82, 101, 118, 105, 115, 105, 0xf3, 110]);
    expect(decodeText(latin.buffer)).toBe("Revisión");
  });
});
