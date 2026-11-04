import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type {
  MetricGroups,
  MetricGroupsQuery,
  MetricsSummary,
  Timeline,
  TimelineQuery,
} from "@tablaria/shared";
import { tableKeys } from "@/features/tables/queries";
import { apiRequest } from "@/lib/api-client";

/** A query string without the parameters left out. */
function params(values: Record<string, string | undefined>): string {
  return new URLSearchParams(
    Object.entries(values).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ).toString();
}

/** What every number column of the table adds up to (ADR-035). */
export function metricsSummaryQuery(tableId: string) {
  return queryOptions({
    queryKey: [...tableKeys.metrics(tableId), "summary"],
    queryFn: () => apiRequest<MetricsSummary>(`/tables/${tableId}/metrics/summary`),
  });
}

export function metricGroupsQuery(tableId: string, query: MetricGroupsQuery) {
  return queryOptions({
    queryKey: [...tableKeys.metrics(tableId), "groups", query],
    queryFn: () => apiRequest<MetricGroups>(`/tables/${tableId}/metrics/groups?${params(query)}`),
    // Keeps the current chart on screen while another grouping loads.
    placeholderData: keepPreviousData,
  });
}

export function timelineQuery(tableId: string, query: TimelineQuery) {
  return queryOptions({
    queryKey: [...tableKeys.metrics(tableId), "timeline", query],
    queryFn: () => apiRequest<Timeline>(`/tables/${tableId}/metrics/timeline?${params(query)}`),
    placeholderData: keepPreviousData,
  });
}
