import type { StockEntryInput, StockHistory, StockMovement, TableRecord } from "@wisedata/shared";
import { apiRequest } from "@/lib/api-client";

const path = (tableId: string, recordId: string) =>
  `/tables/${tableId}/records/${recordId}/movements`;

export const stockMovementsApi = {
  history: (tableId: string, recordId: string, columnId: string) =>
    apiRequest<StockHistory>(`${path(tableId, recordId)}?${new URLSearchParams({ columnId })}`),
  record: (tableId: string, recordId: string, body: StockEntryInput) =>
    apiRequest<{ movement: StockMovement; record: TableRecord }>(path(tableId, recordId), {
      method: "POST",
      body,
    }),
};
