import type { TableColumn, TableRecord } from "@tablaria/shared";
import { describe, expect, it } from "vitest";
import { eventsByDay } from "./calendar-events";

const column = (id: string, definition: object): TableColumn =>
  ({ id, position: 0, createdAt: "", updatedAt: "", ...definition }) as TableColumn;
const record = (id: string, data: TableRecord["data"]): TableRecord => ({ id, data, createdAt: "", updatedAt: "" });

const ORDERED = column("ordered", { name: "Fecha", type: "date" });
const DELIVERY = column("delivery", { name: "Entrega", type: "date" });
const STATUS = column("status", {
  name: "Estado",
  type: "select",
  options: { choices: [{ id: "p", label: "Pendiente", color: "amber" }] },
});

describe("eventsByDay", () => {
  const records = [
    record("a", { ordered: "2026-11-02", delivery: "2026-11-09", status: "Pendiente" }),
    record("b", { ordered: "2026-10-01", delivery: "2026-11-09" }),
  ];

  it("puts a record on the day of each date in range", () => {
    const days = eventsByDay(records, [ORDERED, DELIVERY], undefined, "2026-10-26", "2026-12-06");
    expect([...days.keys()].sort()).toEqual(["2026-11-02", "2026-11-09"]);
    expect(days.get("2026-11-09")?.map(({ key }) => key)).toEqual(["a:delivery", "b:delivery"]);
  });

  it("colors records by their choice and names it", () => {
    const days = eventsByDay(records, [DELIVERY], STATUS, "2026-11-01", "2026-11-30");
    const [colored, plain] = days.get("2026-11-09") ?? [];
    expect(colored).toMatchObject({ color: "amber", colorLabel: "Pendiente" });
    expect(plain?.color).toBeUndefined();
  });
});
