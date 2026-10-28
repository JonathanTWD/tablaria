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
