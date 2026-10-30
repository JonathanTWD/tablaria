import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StockEntryInput } from "@wisedata/shared";
import { refreshAfterWrite } from "@/features/records/queries";
import { stockAlertsQuery } from "@/features/stock-alerts/queries";
import { tableKeys } from "@/features/tables/queries";
import { stockMovementsApi } from "./api";

/** The newest movements of one stock column of a record. */
export function stockHistoryQuery(tableId: string, recordId: string, columnId: string) {
  return queryOptions({
    queryKey: [...tableKeys.movements(tableId), recordId, columnId],
    queryFn: () => stockMovementsApi.history(tableId, recordId, columnId),
  });
}

/** Goods in or out, or a recount: the stock, its history and the alerts change. */
export function useRecordStockEntry(tableId: string, recordId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: StockEntryInput) => stockMovementsApi.record(tableId, recordId, body),
    onSuccess: () =>
      Promise.all([
        refreshAfterWrite(queryClient, tableId),
        queryClient.invalidateQueries({ queryKey: tableKeys.movements(tableId) }),
        queryClient.invalidateQueries({ queryKey: stockAlertsQuery.queryKey }),
      ]),
  });
}
