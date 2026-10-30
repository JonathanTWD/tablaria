import { infiniteQueryOptions } from "@tanstack/react-query";
import type { ActivityPage } from "@wisedata/shared";
import { tableKeys } from "@/features/tables/queries";
import { apiRequest } from "@/lib/api-client";

/** The table's history, newest first, a page at a time (ADR-025). */
export function activityQuery(tableId: string) {
  return infiniteQueryOptions({
    queryKey: tableKeys.activity(tableId),
    queryFn: ({ pageParam }) =>
      apiRequest<ActivityPage>(`/tables/${tableId}/activity?page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: ({ meta }) => (meta.page < meta.pageCount ? meta.page + 1 : undefined),
  });
}
