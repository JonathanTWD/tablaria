import { queryOptions } from "@tanstack/react-query";
import type { StockAlerts } from "@tablaria/shared";
import { apiRequest } from "@/lib/api-client";

/** The most urgent records below their column's threshold, across every table. */
export const stockAlertsQuery = queryOptions({
  queryKey: ["stock-alerts"],
  queryFn: () => apiRequest<StockAlerts>("/stock-alerts"),
});

/** The same for one table, as its metrics show them (ADR-035). Refreshed with the above. */
export function tableStockAlertsQuery(tableId: string) {
  return queryOptions({
    queryKey: [...stockAlertsQuery.queryKey, tableId],
    queryFn: () =>
      apiRequest<StockAlerts>(`/stock-alerts?${new URLSearchParams({ tableId })}`),
  });
}
