import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { MAX_PAGE_SIZE, type Paginated, type TableRecord } from "@tablaria/shared";
import { recordsApi } from "@/features/records/api";
import { tableKeys } from "@/features/tables/queries";

/** Pages read per date column; a month with more records says so instead of loading them all. */
const MAX_PAGES = 5;

/**
 * Records of a date range, in the shape of a record page: it lives under the
 * table's records key, so edits patch it in place and refresh it like the list.
 */
export interface CalendarRecords extends Paginated<TableRecord> {
  linked: Record<string, string>;
  /** Some column had more records in the range than were read. */
  truncated: boolean;
}

async function recordsInRange(tableId: string, columnId: string, from: string, to: string) {
  const records: TableRecord[] = [];
  const linked: Record<string, string> = {};
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await recordsApi.list(tableId, {
      page,
      pageSize: MAX_PAGE_SIZE,
      search: "",
      sort: columnId,
      order: "asc",
      filters: [{ columnId, op: "between", min: from, max: to }],
    });
    records.push(...result.data);
    Object.assign(linked, result.linked);
    if (page >= result.meta.pageCount) {
      return { records, linked, truncated: false };
    }
  }
  return { records, linked, truncated: true };
}

/** Every record with a date between `from` and `to` (inclusive) in any of the columns. */
export function calendarRecordsQuery(tableId: string, columnIds: string[], from: string, to: string) {
  return queryOptions({
    queryKey: [...tableKeys.records(tableId), "calendar", { columnIds, from, to }],
    queryFn: async (): Promise<CalendarRecords> => {
      const results = await Promise.all(
        columnIds.map((columnId) => recordsInRange(tableId, columnId, from, to)),
      );
      // A record with two dates in range comes once per column: keep one.
      const byId = new Map(results.flatMap(({ records }) => records.map((record) => [record.id, record])));
      const data = [...byId.values()];
      return {
        data,
        meta: { page: 1, pageSize: data.length, total: data.length, pageCount: 1 },
        linked: Object.fromEntries(results.flatMap(({ linked }) => Object.entries(linked))),
        truncated: results.some(({ truncated }) => truncated),
      };
    },
    // Keeps the month on screen while the next one loads, but never another table's records.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === tableId ? keepPreviousData(previous) : undefined,
  });
}
