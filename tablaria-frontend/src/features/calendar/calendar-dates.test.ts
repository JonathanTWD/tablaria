import { describe, expect, it } from "vitest";
import { addMonths, monthGrid, parseMonth, todayIso, weekdayNames } from "./calendar-dates";

describe("monthGrid", () => {
  it("covers whole weeks from Monday to Sunday", () => {
    // November 2026 starts on a Sunday and ends on a Monday.
    const days = monthGrid("2026-11");
    expect(days[0]).toBe("2026-10-26");
    expect(days.at(-1)).toBe("2026-12-06");
    expect(days).toHaveLength(42);
  });

  it("needs no extra days when the month fills its weeks", () => {
    // February 2027 starts on a Monday and has 28 days.
    const days = monthGrid("2027-02");
    expect(days[0]).toBe("2027-02-01");
    expect(days.at(-1)).toBe("2027-02-28");
  });
});

describe("months", () => {
  it("moves across years", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("accepts only YYYY-MM", () => {
    expect(parseMonth("2026-11")).toBe("2026-11");
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("nov")).toBeNull();
    expect(parseMonth(null)).toBeNull();
  });
});

describe("dates", () => {
  it("takes today from the viewer's clock", () => {
    expect(todayIso(new Date(2026, 10, 9, 23, 30))).toBe("2026-11-09");
  });

  it("starts the week on Monday", () => {
    expect(weekdayNames("es-ES", "long")[0]).toBe("lunes");
  });
});
