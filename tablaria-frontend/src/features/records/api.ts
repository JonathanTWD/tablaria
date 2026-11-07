import type {
  RecordBatchResult,
  RecordData,
  RecordDetail,
  RecordPage,
  TableRecord,
} from "@tablaria/shared";
import { apiDownload, apiRequest } from "@/lib/api-client";
import type { RecordsView } from "./records-view";

function toQueryString(view: RecordsView): string {
  const params = new URLSearchParams({
    page: String(view.page),
    pageSize: String(view.pageSize),
    order: view.order,
  });
  if (view.search) {
    params.set("search", view.search);
  }
  if (view.sort) {
    params.set("sort", view.sort);
  }
  if (view.filters.length > 0) {
    params.set("filters", JSON.stringify(view.filters));
  }
  if (view.group) {
    params.set("group", view.group);
  }
  return params.toString();
}

/** The view without pagination: an export includes every matching record. */
function toExportQueryString(view: RecordsView): string {
  const params = new URLSearchParams(toQueryString(view));
  params.delete("page");
  params.delete("pageSize");
  params.set("format", "csv");
  return params.toString();
}

export const recordsApi = {
  list: (tableId: string, view: RecordsView) =>
    apiRequest<RecordPage>(`/tables/${tableId}/records?${toQueryString(view)}`),
  create: (tableId: string, data: RecordData) =>
    apiRequest<TableRecord>(`/tables/${tableId}/records`, { method: "POST", body: { data } }),
  update: (tableId: string, recordId: string, data: RecordData) =>
    apiRequest<TableRecord>(`/tables/${tableId}/records/${recordId}`, {
      method: "PATCH",
      body: { data },
    }),
  exportCsv: (tableId: string, view: RecordsView) =>
    apiDownload(`/tables/${tableId}/records/export?${toExportQueryString(view)}`, "registros.csv"),
  get: (tableId: string, recordId: string) =>
    apiRequest<RecordDetail>(`/tables/${tableId}/records/${recordId}`),
  remove: (tableId: string, recordId: string) =>
    apiRequest<void>(`/tables/${tableId}/records/${recordId}`, { method: "DELETE" }),
  updateMany: (tableId: string, ids: string[], data: RecordData) =>
    apiRequest<RecordBatchResult>(`/tables/${tableId}/records/batch`, {
      method: "PATCH",
      body: { ids, data },
    }),
  removeMany: (tableId: string, ids: string[]) =>
    apiRequest<RecordBatchResult>(`/tables/${tableId}/records/batch-delete`, {
      method: "POST",
      body: { ids },
    }),
};
