import type { Attachment } from "@tablaria/shared";
import { apiRequest } from "@/lib/api-client";

function basePath(tableId: string, recordId: string) {
  return `/tables/${tableId}/records/${recordId}/attachments`;
}

/** Where the browser opens a file: the API redirects to a short-lived link (ADR-039). */
export function attachmentUrl(tableId: string, recordId: string, attachmentId: string) {
  return `/api${basePath(tableId, recordId)}/${attachmentId}`;
}

export const attachmentsApi = {
  list: (tableId: string, recordId: string) => apiRequest<Attachment[]>(basePath(tableId, recordId)),

  upload: (tableId: string, recordId: string, file: File) =>
    apiRequest<Attachment>(`${basePath(tableId, recordId)}?${new URLSearchParams({ name: file.name })}`, {
      method: "POST",
      body: file,
    }),

  remove: (tableId: string, recordId: string, attachmentId: string) =>
    apiRequest<void>(`${basePath(tableId, recordId)}/${attachmentId}`, { method: "DELETE" }),
};
