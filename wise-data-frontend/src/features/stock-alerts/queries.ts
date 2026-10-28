import { queryOptions } from "@tanstack/react-query";
import type { StockAlerts } from "@wisedata/shared";
import { apiRequest } from "@/lib/api-client";

/** The most urgent records below their column's threshold, across every table. */
export const stockAlertsQuery = queryOptions({
  queryKey: ["stock-alerts"],
  queryFn: () => apiRequest<StockAlerts>("/stock-alerts"),
});
