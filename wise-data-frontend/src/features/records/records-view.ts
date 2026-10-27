import {
  DEFAULT_PAGE_SIZE,
  FILTER_OPERATOR_BY_TYPE,
  SEARCH_MAX_LENGTH,
  recordFilterSchema,
  recordListQuerySchema,
  type RecordFilter,
  type SortOrder,
  type TableColumn,
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

const { shape } = recordListQuerySchema;

/** Parses one URL parameter, falling back to its default when missing or malformed. */
function param<T>(schema: z.ZodType<T>, raw: string | null, fallback: T): T {
  const result = schema.safeParse(raw ?? undefined);
  return result.success ? result.data : fallback;
}

/** Reads the view from the URL; each malformed parameter falls back on its own. */
export function parseRecordsView(params: URLSearchParams): RecordsView {
  return {
    page: param(shape.page, params.get("page"), DEFAULT_VIEW.page),
    pageSize: param(shape.pageSize, params.get("pageSize"), DEFAULT_VIEW.pageSize),
    search: param(z.string().trim().max(SEARCH_MAX_LENGTH), params.get("q"), ""),
    sort: param(shape.sort, params.get("sort"), undefined),
    order: param(shape.order, params.get("order"), DEFAULT_VIEW.order),
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

/**
 * Drops the sort and filters that point at columns which no longer exist (or
 * changed type), so an old link still opens instead of failing with a 400.
 */
export function applicableView(view: RecordsView, columns: TableColumn[]): RecordsView {
  const byId = new Map(columns.map((column) => [column.id, column]));
  return {
    ...view,
    sort: view.sort && byId.has(view.sort) ? view.sort : undefined,
    filters: view.filters.filter((filter) => {
      const column = byId.get(filter.columnId);
      return column !== undefined && FILTER_OPERATOR_BY_TYPE[column.type] === filter.op;
    }),
  };
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
 * The current view and a setter. Changes merge into the URL as it is when they
 * apply (not as it was when the caller rendered), so a delayed update such as
 * the debounced search never undoes a newer one. Any change other than the
 * page itself goes back to page 1, since the old page may no longer exist.
 */
export function useRecordsView() {
  const [params, setParams] = useSearchParams();
  const view = parseRecordsView(params);

  const update = (patch: Partial<RecordsView>, { replace = false } = {}) => {
    setParams((current) => toSearchParams({ ...parseRecordsView(current), page: 1, ...patch }), {
      replace,
    });
  };

  return [view, update] as const;
}
