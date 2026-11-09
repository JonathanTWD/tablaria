import type { SelectColor, TableColumn, TableRecord } from "@tablaria/shared";

/** One record on one day: a record with two dates in view shows on both. */
export interface CalendarEvent {
  /** Unique per record and date column. */
  key: string;
  record: TableRecord;
  column: TableColumn;
  day: string;
  color?: SelectColor;
  /** The choice the color stands for, so it isn't told by color alone. */
  colorLabel?: string;
}

/**
 * The events between `from` and `to` (inclusive), grouped by day, in the
 * order of the date columns and then of the records.
 */
export function eventsByDay(
  records: TableRecord[],
  dateColumns: TableColumn[],
  colorColumn: TableColumn | undefined,
  from: string,
  to: string,
): Map<string, CalendarEvent[]> {
  const colors =
    colorColumn?.type === "select"
      ? new Map(colorColumn.options.choices.map((choice) => [choice.label, choice.color]))
      : undefined;
  const byDay = new Map<string, CalendarEvent[]>();
  for (const column of dateColumns) {
    for (const record of records) {
      const day = record.data[column.id];
      if (typeof day !== "string" || day < from || day > to) {
        continue;
      }
      const choice = colorColumn ? record.data[colorColumn.id] : undefined;
      const event: CalendarEvent = {
        key: `${record.id}:${column.id}`,
        record,
        column,
        day,
        color: typeof choice === "string" ? colors?.get(choice) : undefined,
        colorLabel: typeof choice === "string" ? choice : undefined,
      };
      byDay.set(day, [...(byDay.get(day) ?? []), event]);
    }
  }
  return byDay;
}
