import { describe, expect, it } from "vitest";
import { columnFormDefaults, columnFormSchema, toColumnDefinition } from "./column-form";

const quantity = { ...columnFormDefaults(), name: "Cantidad", type: "number" as const };

describe("column form low-stock threshold", () => {
  it("sends a threshold typed with a decimal comma, or none when empty", () => {
    expect(toColumnDefinition({ ...quantity, alertBelow: "2,5" }).options).toEqual({
      alertBelow: 2.5,
    });
    expect(toColumnDefinition({ ...quantity, alertBelow: " " }).options).toBeNull();
  });

  it("marks a negative or non-numeric threshold on its own field", () => {
    for (const alertBelow of ["-1", "cinco"]) {
      const result = columnFormSchema.safeParse({ ...quantity, alertBelow });
      expect(result.error?.issues.map(({ path }) => path)).toEqual([["alertBelow"]]);
    }
  });
});

describe("column form unique values", () => {
  it("sends no default for a unique column", () => {
    const sku = { ...columnFormDefaults(), name: "SKU", unique: true, defaultValue: "A-1" };
    expect(toColumnDefinition(sku)).toMatchObject({ unique: true, defaultValue: null });
  });

  it("drops the flag for types that can't be unique", () => {
    const active = { ...columnFormDefaults(), name: "Activo", type: "boolean" as const, unique: true };
    expect(toColumnDefinition(active).unique).toBe(false);
  });
});

describe("column form stock", () => {
  it("keeps a stock column's flag, and drops it for other types", () => {
    const stock = { ...columnFormDefaults(), name: "Stock", type: "number" as const, stock: true };
    expect(toColumnDefinition(stock).stock).toBe(true);
    expect(toColumnDefinition({ ...stock, type: "text" }).stock).toBe(false);
  });
});
