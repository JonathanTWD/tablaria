import { columnDefinitionSchema, type TableColumn } from "@wisedata/shared";
import { describe, expect, it } from "vitest";
import { matchColumns } from "./column-matching";

function column(id: string, definition: object): TableColumn {
  return {
    ...columnDefinitionSchema.parse(definition),
    id,
    position: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const columns = [
  column("product", { name: "Producto", type: "text" }),
  column("price", { name: "Precio", type: "currency", options: { currency: "EUR" } }),
  column("checked", { name: "Última revisión", type: "date" }),
];

describe("matchColumns", () => {
  it("matches headers by name, ignoring case, accents and our export's currency", () => {
    expect(matchColumns(["PRODUCTO", "precio (EUR)", "ultima revision", "Notas"], columns)).toEqual([
      "product",
      "price",
      "checked",
      null,
    ]);
  });

  it("uses each table column once", () => {
    expect(matchColumns(["Producto", "producto"], columns)).toEqual(["product", null]);
  });
});
