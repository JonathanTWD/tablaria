import type { ImportCheck, ImportInput, ImportResult } from "@wisedata/shared";
import { apiRequest } from "@/lib/api-client";

export const importsApi = {
  check: (tableId: string, body: ImportInput) =>
    apiRequest<ImportCheck>(`/tables/${tableId}/import/check`, { method: "POST", body }),
  run: (tableId: string, body: ImportInput) =>
    apiRequest<ImportResult>(`/tables/${tableId}/import`, { method: "POST", body }),
};
