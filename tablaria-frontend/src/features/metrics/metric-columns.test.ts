import { columnDefinitionSchema, type TableColumn, type TimelineBucket } from "@tablaria/shared";
import { describe, expect, it } from "vitest";
import { defaultGroupBy, fillTimeline, parseMeasure } from "./metric-columns";

function column(id: string, position: number, definition: object): TableColumn {
  return {
    ...columnDefinitionSchema.parse(definition),
    id,
    position,
    createdAt: "",
    updatedAt: "",
  };
}

const bucket = (start: string, count: number): TimelineBucket => ({
  start,
  count,
  filled: 0,
  measure: null,
});

describe("fillTimeline", () => {
  it("shows the periods without records between those with them", () => {
    expect(
      fillTimeline([bucket("2026-01-01", 2), bucket("2026-04-01", 1)], "month").map(
        ({ start, count }) => [start, count],
      ),
    ).toEqual([
      ["2026-01-01", 2],
      ["2026-02-01", 0],
      ["2026-03-01", 0],
      ["2026-04-01", 1],
    ]);
    expect(
      fillTimeline([bucket("2025-12-29", 1), bucket("2026-01-12", 1)], "week").map(
        ({ start }) => start,
      ),
    ).toEqual(["2025-12-29", "2026-01-05", "2026-01-12"]);
    expect(fillTimeline([], "day")).toEqual([]);
  });

  it("keeps the most recent periods when the gaps add up to too many", () => {
    const filled = fillTimeline([bucket("2020-01-01", 1), bucket("2026-01-01", 1)], "month");
    expect(filled).toHaveLength(36);
    expect(filled.at(-1)?.start).toBe("2026-01-01");
  });
});

describe("metric columns", () => {
  const name = column("name", 0, { name: "Nombre", type: "text" });
  const notes = column("notes", 1, { name: "Notas", type: "text" });
  const active = column("active", 2, { name: "Activo", type: "boolean" });
  const salary = column("salary", 3, {
    name: "Salario",
    type: "currency",
    options: { currency: "EUR" },
  });

  it("groups by the most useful column, never the one naming the records", () => {
    expect(defaultGroupBy([name, notes, active, salary])).toBe(active);
    expect(defaultGroupBy([name, notes])).toBe(notes);
    expect(defaultGroupBy([name])).toBeUndefined();
  });

  it("reads a measure only for a number column of the table", () => {
    expect(parseMeasure("avg:salary", [name, salary])).toEqual({ column: salary, fn: "avg" });
    expect(parseMeasure("avg:notes", [name, notes])).toBeNull();
    expect(parseMeasure("median:salary", [salary])).toBeNull();
    expect(parseMeasure("count", [salary])).toBeNull();
  });
});
