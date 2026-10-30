import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { OrganizationInput, OrganizationInviteInput, TableRole } from "@tablaria/shared";
import { tableKeys } from "@/features/tables/queries";
import { organizationsApi } from "./api";

export const organizationKeys = {
  all: ["organizations"] as const,
  list: () => [...organizationKeys.all, "list"] as const,
  detail: (id: string) => [...organizationKeys.all, "detail", id] as const,
};

/** The personal space first, then the user's organizations by name. */
export const organizationsQuery = queryOptions({
  queryKey: organizationKeys.list(),
  queryFn: organizationsApi.list,
});

export function organizationQuery(id: string) {
  return queryOptions({
    queryKey: organizationKeys.detail(id),
    queryFn: () => organizationsApi.get(id),
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OrganizationInput) => organizationsApi.create(body),
    onSuccess: (organization) => {
      queryClient.setQueryData(organizationKeys.detail(organization.id), organization);
      return queryClient.invalidateQueries({ queryKey: organizationKeys.list() });
    },
  });
}

/** Members, invitations and the name: each change refreshes the page and the switcher. */
function useOrganizationMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
  });
}

export function useRenameOrganization(id: string) {
  return useOrganizationMutation((body: OrganizationInput) => organizationsApi.rename(id, body));
}

export function useInviteToOrganization(id: string) {
  return useOrganizationMutation((body: OrganizationInviteInput) =>
    organizationsApi.invite(id, body),
  );
}

export function useRevokeOrganizationInvitation(id: string) {
  return useOrganizationMutation((invitationId: string) =>
    organizationsApi.revoke(id, invitationId),
  );
}

export function useUpdateMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TableRole }) =>
      organizationsApi.updateMember(id, userId, role),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
        // A changed role changes what its tables let that person do.
        queryClient.invalidateQueries({ queryKey: tableKeys.all }),
      ]),
  });
}

export function useRemoveMember(id: string) {
  return useOrganizationMutation((userId: string) => organizationsApi.removeMember(id, userId));
}

/** Leaving or deleting: the organization and its tables disappear for this user. */
export function useLeaveOrDeleteOrganization(id: string, action: "leave" | "delete") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      action === "delete" ? organizationsApi.remove(id) : organizationsApi.removeMember(id, userId),
    // The page is left before its query goes stale: removing it here would
    // refetch, unmount the page and drop the caller's navigation.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationKeys.list() }),
        queryClient.invalidateQueries({ queryKey: tableKeys.all }),
      ]),
  });
}
