import {
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

/** Stores the user returned by login/verification so guards see the new session at once. */
export function useStartSession() {
  const queryClient = useQueryClient();
  return (user: AuthUser) => queryClient.setQueryData(sessionQueryKey, user);
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      // Drop every cached resource of the previous user, then mark the session as empty.
      queryClient.clear();
      queryClient.setQueryData(sessionQueryKey, null);
    },
  });
}
