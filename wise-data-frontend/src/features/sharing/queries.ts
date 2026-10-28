import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InviteInput, ShareRole } from "@wisedata/shared";
import { tableKeys } from "@/features/tables/queries";
import { sharingApi } from "./api";

/** Tables other people shared with the current user. */
export const sharedTablesQuery = queryOptions({
  queryKey: tableKeys.shared(),
  queryFn: sharingApi.sharedWithMe,
});

export function tableSharingQuery(tableId: string) {
  return queryOptions({
    queryKey: tableKeys.sharing(tableId),
    queryFn: () => sharingApi.get(tableId),
  });
}

/** Every change to who has access refreshes the table's sharing panel. */
function useSharingMutation<TInput, TResult>(
  tableId: string,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tableKeys.sharing(tableId) }),
  });
}

export function useInvite(tableId: string) {
  return useSharingMutation(tableId, (body: InviteInput) => sharingApi.invite(tableId, body));
}

export function useRevokeInvitation(tableId: string) {
  return useSharingMutation(tableId, (invitationId: string) =>
    sharingApi.revoke(tableId, invitationId),
  );
}

export function useUpdateShare(tableId: string) {
  return useSharingMutation(tableId, ({ userId, role }: { userId: string; role: ShareRole }) =>
    sharingApi.updateShare(tableId, userId, role),
  );
}

export function useRemoveShare(tableId: string) {
  return useSharingMutation(tableId, (userId: string) => sharingApi.removeShare(tableId, userId));
}

/** Leaving a shared table: it disappears from the lists and its page. */
export function useLeaveTable(tableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => sharingApi.removeShare(tableId, userId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: tableKeys.detail(tableId) });
      return queryClient.invalidateQueries({ queryKey: tableKeys.shared() });
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sharingApi.accept,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tableKeys.shared() }),
  });
}
