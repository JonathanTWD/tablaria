import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ImportInput } from "@wisedata/shared";
import { tableKeys } from "@/features/tables/queries";
import { importsApi } from "./api";

export function useCheckImport(tableId: string) {
  return useMutation({ mutationFn: (body: ImportInput) => importsApi.check(tableId, body) });
}

/** New records, and maybe new select choices: the whole table refreshes. */
export function useRunImport(tableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ImportInput) => importsApi.run(tableId, body),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: tableKeys.records(tableId) }),
        queryClient.invalidateQueries({ queryKey: tableKeys.stats(tableId) }),
        queryClient.invalidateQueries({ queryKey: tableKeys.detail(tableId) }),
        queryClient.invalidateQueries({ queryKey: tableKeys.list() }),
      ]),
  });
}
