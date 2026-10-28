import type { Paginated, RecordData, TableRecord } from "@wisedata/shared";
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
    apiRequest<Paginated<TableRecord>>(`/tables/${tableId}/records?${toQueryString(view)}`),
  create: (tableId: string, data: RecordData) =>
    apiRequest<TableRecord>(`/tables/${tableId}/records`, { method: "POST", body: { data } }),
  update: (tableId: string, recordId: string, data: RecordData) =>
    apiRequest<TableRecord>(`/tables/${tableId}/records/${recordId}`, {
      method: "PATCH",
      body: { data },
    }),
  exportCsv: (tableId: string, view: RecordsView) =>
    apiDownload(`/tables/${tableId}/records/export?${toExportQueryString(view)}`, "registros.csv"),
  remove: (tableId: string, recordId: string) =>
    apiRequest<void>(`/tables/${tableId}/records/${recordId}`, { method: "DELETE" }),
};
