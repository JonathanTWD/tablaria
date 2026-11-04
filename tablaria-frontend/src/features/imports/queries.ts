import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ImportInput, TableDetail } from "@tablaria/shared";
import { tableKeys } from "@/features/tables/queries";
import { importsApi } from "./api";

/** Where an import goes: an existing table, or a new one in a space. */
export type ImportDestination =
  | { kind: "table"; table: TableDetail }
  | { kind: "newTable"; organizationId: string };

/** A new table also needs its name. */
export type ImportBody = ImportInput & { name: string };

export function useCheckImport(destination: ImportDestination) {
  return useMutation({
    mutationFn: ({ name, ...body }: ImportBody) =>
      destination.kind === "table"
        ? importsApi.check(destination.table.id, body)
        : importsApi.checkNewTable(destination.organizationId, { ...body, name }),
  });
}

/** New records, maybe new columns or a new table: what shows them refreshes. */
export function useRunImport(destination: ImportDestination) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, ...body }: ImportBody) =>
      destination.kind === "table"
        ? importsApi.run(destination.table.id, body)
        : importsApi.runNewTable(destination.organizationId, { ...body, name }),
    onSuccess: ({ tableId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: tableKeys.records(tableId) }),
        queryClient.invalidateQueries({ queryKey: tableKeys.metrics(tableId) }),
        queryClient.invalidateQueries({ queryKey: tableKeys.detail(tableId) }),
        queryClient.invalidateQueries({ queryKey: tableKeys.list() }),
      ]),
  });
}
