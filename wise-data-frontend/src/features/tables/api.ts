import type {
  ColumnDefinitionInput,
  CreateTableInput,
  TableColumn,
  TableDetail,
  TableSummary,
  UpdateColumnInput,
  UpdateColumnResponse,
  UpdateTableInput,
} from "@wisedata/shared";
import { apiRequest } from "@/lib/api-client";

export const tablesApi = {
  list: () => apiRequest<TableSummary[]>("/tables"),
  get: (tableId: string) => apiRequest<TableDetail>(`/tables/${tableId}`),
  create: (body: CreateTableInput) =>
    apiRequest<TableDetail>("/tables", { method: "POST", body }),
  update: (tableId: string, body: UpdateTableInput) =>
    apiRequest<TableDetail>(`/tables/${tableId}`, { method: "PATCH", body }),
  remove: (tableId: string) =>
    apiRequest<void>(`/tables/${tableId}`, { method: "DELETE" }),
};

export const columnsApi = {
  create: (tableId: string, body: ColumnDefinitionInput) =>
    apiRequest<TableColumn>(`/tables/${tableId}/columns`, { method: "POST", body }),
  update: (tableId: string, columnId: string, body: UpdateColumnInput) =>
    apiRequest<UpdateColumnResponse>(`/tables/${tableId}/columns/${columnId}`, {
      method: "PATCH",
      body,
    }),
  reorder: (tableId: string, columnIds: string[]) =>
    apiRequest<TableColumn[]>(`/tables/${tableId}/columns/order`, {
      method: "PATCH",
      body: { columnIds },
    }),
  remove: (tableId: string, columnId: string) =>
    apiRequest<void>(`/tables/${tableId}/columns/${columnId}`, { method: "DELETE" }),
};
