import type {
  ImportCheck,
  ImportInput,
  ImportNewTableInput,
  ImportResult,
} from "@tablaria/shared";
import { apiRequest } from "@/lib/api-client";

export const importsApi = {
  check: (tableId: string, body: ImportInput) =>
    apiRequest<ImportCheck>(`/tables/${tableId}/import/check`, { method: "POST", body }),
  run: (tableId: string, body: ImportInput) =>
    apiRequest<ImportResult>(`/tables/${tableId}/import`, { method: "POST", body }),
  checkNewTable: (organizationId: string, body: ImportNewTableInput) =>
    apiRequest<ImportCheck>(`/organizations/${organizationId}/tables/import/check`, {
      method: "POST",
      body,
    }),
  runNewTable: (organizationId: string, body: ImportNewTableInput) =>
    apiRequest<ImportResult>(`/organizations/${organizationId}/tables/import`, {
      method: "POST",
      body,
    }),
};
