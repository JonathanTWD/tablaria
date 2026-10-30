import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { tableKeys } from "@/features/tables/queries";
import { publicLinksApi } from "./api";

/** Under the table's sharing key: realtime "sharing" changes refresh it too. */
export function publicLinkQuery(tableId: string) {
  return queryOptions({
    queryKey: [...tableKeys.sharing(tableId), "public-link"],
    queryFn: () => publicLinksApi.status(tableId),
  });
}

function usePublicLinkMutation<T>(tableId: string, mutationFn: () => Promise<T>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: publicLinkQuery(tableId).queryKey }),
  });
}

export function useCreatePublicLink(tableId: string) {
  return usePublicLinkMutation(tableId, () => publicLinksApi.create(tableId));
}

export function useRemovePublicLink(tableId: string) {
  return usePublicLinkMutation(tableId, () => publicLinksApi.remove(tableId));
}
