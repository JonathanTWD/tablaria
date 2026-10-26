import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { AuthUser } from "@wisedata/shared";
import { ApiError } from "@/lib/api-client";
import { authApi } from "./api";

export const sessionQueryKey = ["auth", "session"] as const;

/** The signed-in user, or null when there is no valid session. */
export const sessionQuery = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: async (): Promise<AuthUser | null> => {
    try {
      return await authApi.me();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return null;
      }
      throw error;
    }
  },
  staleTime: 5 * 60 * 1000,
  retry: false,
});

export function useSession() {
  return useQuery(sessionQuery);
}

/**
 * Drops every cached resource except the session itself. `queryClient.clear()`
 * would also drop the session query, detaching the guards that observe it.
 */
function removeUserData(queryClient: QueryClient) {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== sessionQueryKey[0],
  });
}

/** Stores the user returned by login/verification so guards see the new session at once. */
export function useStartSession() {
  const queryClient = useQueryClient();
  return (user: AuthUser) => {
    // Another account's cached data must never be shown to this user.
    if (queryClient.getQueryData(sessionQuery.queryKey)?.id !== user.id) {
      removeUserData(queryClient);
    }
    queryClient.setQueryData(sessionQuery.queryKey, user);
  };
}

/** Forgets the session and every cached resource that belonged to it. */
export function useEndSession() {
  const queryClient = useQueryClient();
  return () => {
    removeUserData(queryClient);
    queryClient.setQueryData(sessionQuery.queryKey, null);
  };
}

/** On success the session becomes empty and RequireAuth sends the user to /login. */
export function useLogout() {
  const endSession = useEndSession();
  return useMutation({ mutationFn: authApi.logout, onSuccess: endSession });
}
