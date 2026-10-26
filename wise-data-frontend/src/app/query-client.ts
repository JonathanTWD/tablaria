import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { sessionQueryKey } from "@/features/auth/session";
import { ApiError } from "@/lib/api-client";

/**
 * A protected request that is still 401 after the automatic refresh means the
 * session is gone. Public auth calls (e.g. a wrong password) are not affected.
 */
function endSessionOnUnauthorized(error: Error) {
  if (error instanceof ApiError && error.sessionExpired) {
    queryClient.setQueryData(sessionQueryKey, null);
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: endSessionOnUnauthorized }),
  mutationCache: new MutationCache({ onError: endSessionOnUnauthorized }),
  defaultOptions: {
    queries: {
      // Client errors (4xx) won't fix themselves; only retry network and server failures.
      retry: (failureCount, error) =>
        failureCount < 2 && !(error instanceof ApiError && error.status < 500),
      refetchOnWindowFocus: false,
    },
  },
});
