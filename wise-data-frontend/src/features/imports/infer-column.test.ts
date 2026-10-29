import { columnDefinitionSchema } from "@wisedata/shared";
import { describe, expect, it } from "vitest";
import { columnForFile, inferType } from "./infer-column";

describe("inferType", () => {
  it("recognizes numbers, prices, dates and yes/no as spreadsheets write them", () => {
    expect(inferType("Stock", ["12", "1.234", "", "3,5"])).toBe("number");
    expect(inferType("Precio", ["89,90 €", "12 €"])).toBe("currency");
    expect(inferType("Precio (USD)", ["89.90", "12"])).toBe("currency");
    expect(inferType("Compra", ["15/03/2025", "2025-02-01"])).toBe("date");
    expect(inferType("Destacado", ["Sí", "no", "SI"])).toBe("boolean");
  });

  it("offers a list for a few repeated values, and text otherwise", () => {
    const statuses = ["Disponible", "Agotado", "disponible", "Agotado", "Disponible", "Reservado"];
    expect(inferType("Estado", statuses)).toBe("select");
    expect(inferType("Producto", ["Taladro", "Sierra", "Llave", "Martillo"])).toBe("text");
    expect(inferType("Notas", ["", ""])).toBe("text");
  });
});

describe("columnForFile", () => {
  it("builds valid column definitions with the settings each type needs", () => {
    const status = columnForFile("select", "Estado", ["Disponible", "agotado", "Agotado", ""], [], "Opción");
    expect(columnDefinitionSchema.parse(status)).toMatchObject({
      name: "Estado",
      type: "select",
      options: { choices: [{ label: "Disponible" }, { label: "agotado" }] },
    });
    const price = columnForFile("currency", "Precio (USD)", ["12"], [], "Opción");
    expect(columnDefinitionSchema.parse(price)).toMatchObject({
      name: "Precio",
      options: { currency: "USD" },
    });
    const empty = columnForFile("select", "Zona", [], [], "Opción");
    expect(columnDefinitionSchema.parse(empty).options).toMatchObject({ choices: [{ label: "Opción" }] });
  });

  it("never repeats the name of another column", () => {
    expect(columnForFile("text", "stock", [], ["Stock", "Stock 2"], "Opción").name).toBe("stock 3");
  });
});
