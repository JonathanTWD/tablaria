import {
  DEFAULT_PAGE_SIZE,
  recordFilterSchema,
  recordListQuerySchema,
  type RecordFilter,
  type SortOrder,
} from "@wisedata/shared";
import { useSearchParams } from "react-router";
import { z } from "zod";

/** What the records table shows. Lives in the URL, so it can be shared and survives reloads. */
export interface RecordsView {
  page: number;
  pageSize: number;
  search: string;
  sort?: string;
  order: SortOrder;
  filters: RecordFilter[];
}

export const PAGE_SIZES = [25, 50, 100] as const;

const DEFAULT_VIEW: RecordsView = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  search: "",
  order: "asc",
  filters: [],
};

const viewSchema = recordListQuerySchema.omit({ filters: true }).extend({
  search: z.string().default(""),
});

/** Reads the view from the URL; anything malformed falls back to its default. */
export function parseRecordsView(params: URLSearchParams): RecordsView {
  const view = viewSchema.safeParse({
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
    search: params.get("q") ?? undefined,
    sort: params.get("sort") ?? undefined,
    order: params.get("order") ?? undefined,
  });
  return {
    ...(view.success ? view.data : DEFAULT_VIEW),
    filters: parseFilters(params.get("filters")),
  };
}

function parseFilters(raw: string | null): RecordFilter[] {
  if (!raw) {
    return [];
  }
  try {
    const result = z.array(recordFilterSchema).safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

function toSearchParams(view: RecordsView): URLSearchParams {
  const entries: [string, string | undefined | false][] = [
    ["page", view.page !== DEFAULT_VIEW.page && String(view.page)],
    ["pageSize", view.pageSize !== DEFAULT_VIEW.pageSize && String(view.pageSize)],
    ["q", view.search],
    ["sort", view.sort],
    ["order", view.sort && view.order],
    ["filters", view.filters.length > 0 && JSON.stringify(view.filters)],
  ];
  return new URLSearchParams(
    entries.filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

/**
 * The current view and a setter. Any change other than the page itself goes
 * back to page 1, since the old page may no longer exist.
 */
export function useRecordsView() {
  const [params, setParams] = useSearchParams();
  const view = parseRecordsView(params);

  const update = (patch: Partial<RecordsView>, { replace = false } = {}) => {
    const next = { ...view, page: 1, ...patch };
    setParams(toSearchParams(next), { replace });
  };

  return [view, update] as const;
}
