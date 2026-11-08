import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AssistantChat, AssistantReply, AssistantStatus } from "@tablaria/shared";
import { apiRequest } from "@/lib/api-client";

const statusKey = ["assistant", "status"] as const;

/** Whether the assistant is on, and the questions left today (ADR-042). */
export const assistantStatusQuery = queryOptions({
  queryKey: statusKey,
  queryFn: () => apiRequest<AssistantStatus>("/assistant"),
  staleTime: 60_000,
});

export function useAskAssistant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chat: AssistantChat) =>
      apiRequest<AssistantReply>("/assistant/chat", { method: "POST", body: chat }),
    onSuccess: ({ remaining }) =>
      queryClient.setQueryData<AssistantStatus>(statusKey, (status) => status && { ...status, remaining }),
    // A refused question (limit, busy) may still have changed the count.
    onError: () => queryClient.invalidateQueries({ queryKey: statusKey }),
  });
}
