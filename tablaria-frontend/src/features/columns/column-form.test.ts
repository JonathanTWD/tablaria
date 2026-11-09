import { type ColumnDefinition, daysUntil, dueSoon } from "@tablaria/shared";
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

describe("column form date warning", () => {
  const delivery = { ...columnFormDefaults(), name: "Entrega", type: "date" as const };

  it("sends the days before, or none when empty", () => {
    expect(toColumnDefinition({ ...delivery, alertDaysBefore: "7" }).options).toEqual({ alertDaysBefore: 7 });
    expect(toColumnDefinition({ ...delivery, alertDaysBefore: "" }).options).toBeNull();
  });

  it("marks days that aren't a whole number from 0 to 365 on their own field", () => {
    for (const alertDaysBefore of ["-1", "1,5", "366", "siete"]) {
      const result = columnFormSchema.safeParse({ ...delivery, alertDaysBefore });
      expect(result.error?.issues.map(({ path }) => path)).toEqual([["alertDaysBefore"]]);
    }
  });
});

describe("dueSoon", () => {
  const delivery: ColumnDefinition = {
    name: "Entrega",
    type: "date",
    required: false,
    unique: false,
    stock: false,
    options: { alertDaysBefore: 7 },
    defaultValue: null,
  };

  it("gives the days left from today to the warning", () => {
    expect(dueSoon(delivery, "2026-11-09", "2026-11-09")).toBe(0);
    expect(dueSoon(delivery, "2026-11-16", "2026-11-09")).toBe(7);
    expect(daysUntil("2026-12-01", "2026-11-30")).toBe(1);
  });

  it("ignores dates past or beyond the warning, and columns without one", () => {
    expect(dueSoon(delivery, "2026-11-08", "2026-11-09")).toBeNull();
    expect(dueSoon(delivery, "2026-11-17", "2026-11-09")).toBeNull();
    expect(dueSoon({ ...delivery, options: null }, "2026-11-10", "2026-11-09")).toBeNull();
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
