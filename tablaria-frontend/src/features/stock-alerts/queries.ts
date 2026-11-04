import { queryOptions } from "@tanstack/react-query";
import type { StockAlerts } from "@tablaria/shared";
import { apiRequest } from "@/lib/api-client";

/** Every table's stock alerts: invalidating it refreshes them all. */
export const stockAlertsKey = ["stock-alerts"] as const;

/** A table's records below their column's threshold, as its metrics show them (ADR-035). */
export function tableStockAlertsQuery(tableId: string) {
  return queryOptions({
    queryKey: [...stockAlertsKey, tableId],
    queryFn: () =>
      apiRequest<StockAlerts>(`/stock-alerts?${new URLSearchParams({ tableId })}`),
  });
}
