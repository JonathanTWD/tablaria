import { columnDefinitionSchema, type TableColumn } from "@tablaria/shared";
import { describe, expect, it } from "vitest";
import { defaultGroupBy, groupableColumns, summableColumns } from "./chart-columns";

function column(id: string, definition: object): TableColumn {
  return {
    ...columnDefinitionSchema.parse({ name: id, ...definition }),
    id,
    position: 0,
    createdAt: "",
    updatedAt: "",
  };
}

const product = column("product", { type: "text" });
const category = column("category", { type: "text" });
const featured = column("featured", { type: "boolean" });
const status = column("status", {
  type: "select",
  options: { choices: [{ id: "a", label: "Disponible", color: "green" }] },
});
const stock = column("stock", { type: "number" });
const price = column("price", { type: "currency", options: { currency: "EUR" } });

describe("chart columns", () => {
  it("never groups by the first column, which names each record", () => {
    expect(groupableColumns([product, category, stock])).toEqual([category]);
  });

  it("prefers a list, then yes/no, then text to group by", () => {
    expect(defaultGroupBy([product, category, featured, status])).toBe(status);
    expect(defaultGroupBy([product, category, featured])).toBe(featured);
    expect(defaultGroupBy([product, category])).toBe(category);
    expect(defaultGroupBy([product, stock])).toBeUndefined();
  });

  it("adds up numbers and prices", () => {
    expect(summableColumns([product, stock, price, status])).toEqual([stock, price]);
  });
});
