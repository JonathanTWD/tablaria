import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { tableKeys } from "@/features/tables/queries";
import { attachmentsApi } from "./api";

function attachmentsKey(tableId: string, recordId: string) {
  // Under the record's detail, so whatever refreshes the record refreshes them.
  return [...tableKeys.recordDetails(tableId), recordId, "attachments"] as const;
}

export function attachmentsQuery(tableId: string, recordId: string) {
  return queryOptions({
    queryKey: attachmentsKey(tableId, recordId),
    queryFn: () => attachmentsApi.list(tableId, recordId),
  });
}

export function useUploadAttachment(tableId: string, recordId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(tableId, recordId, file),
    onSettled: () => queryClient.invalidateQueries({ queryKey: attachmentsKey(tableId, recordId) }),
  });
}

export function useDeleteAttachment(tableId: string, recordId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => attachmentsApi.remove(tableId, recordId, attachmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attachmentsKey(tableId, recordId) }),
  });
}
