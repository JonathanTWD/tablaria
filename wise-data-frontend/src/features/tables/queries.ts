import {
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  ColumnDefinitionInput,
  CreateTableInput,
  TableDetail,
  UpdateColumnInput,
  UpdateTableInput,
} from "@wisedata/shared";
import { columnsApi, tablesApi } from "./api";

export const tableKeys = {
  all: ["tables"] as const,
  list: () => [...tableKeys.all, "list"] as const,
  detail: (tableId: string) => [...tableKeys.all, "detail", tableId] as const,
  records: (tableId: string) => [...tableKeys.all, "records", tableId] as const,
  // Apart from `records`: those queries all hold record pages, which edits patch in place.
  stats: (tableId: string) => [...tableKeys.all, "stats", tableId] as const,
  shared: () => [...tableKeys.all, "shared"] as const,
  sharing: (tableId: string) => [...tableKeys.all, "sharing", tableId] as const,
};

/** Every table of the user, most recently edited first. */
export const tablesQuery = queryOptions({
  queryKey: tableKeys.list(),
  queryFn: tablesApi.list,
});

export function tableQuery(tableId: string) {
  return queryOptions({
    queryKey: tableKeys.detail(tableId),
    queryFn: () => tablesApi.get(tableId),
  });
}

/**
 * Column changes also change the table's counts and last edit in the list,
 * and the records themselves (type conversions, deleted columns).
 */
function refreshTable(queryClient: QueryClient, tableId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: tableKeys.detail(tableId) }),
    queryClient.invalidateQueries({ queryKey: tableKeys.records(tableId) }),
    queryClient.invalidateQueries({ queryKey: tableKeys.stats(tableId) }),
    queryClient.invalidateQueries({ queryKey: tableKeys.list() }),
  ]);
}

export function useCreateTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTableInput) => tablesApi.create(body),
    onSuccess: (table) => {
      queryClient.setQueryData(tableKeys.detail(table.id), table);
      return queryClient.invalidateQueries({ queryKey: tableKeys.list() });
    },
  });
}

export function useUpdateTable(tableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateTableInput) => tablesApi.update(tableId, body),
    onSuccess: (table) => {
      queryClient.setQueryData(tableKeys.detail(tableId), table);
      return queryClient.invalidateQueries({ queryKey: tableKeys.list() });
    },
  });
}

export function useDeleteTable(tableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tablesApi.remove(tableId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: tableKeys.detail(tableId) });
      queryClient.removeQueries({ queryKey: tableKeys.records(tableId) });
      queryClient.removeQueries({ queryKey: tableKeys.stats(tableId) });
      return queryClient.invalidateQueries({ queryKey: tableKeys.list() });
    },
  });
}

export function useCreateColumn(tableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ColumnDefinitionInput) => columnsApi.create(tableId, body),
    onSuccess: () => refreshTable(queryClient, tableId),
  });
}

export function useUpdateColumn(tableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, body }: { columnId: string; body: UpdateColumnInput }) =>
      columnsApi.update(tableId, columnId, body),
    onSuccess: () => refreshTable(queryClient, tableId),
  });
}

export function useDeleteColumn(tableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (columnId: string) => columnsApi.remove(tableId, columnId),
    onSuccess: () => refreshTable(queryClient, tableId),
  });
}

/** Moves columns at once in the UI and puts them back if the API refuses. */
export function useReorderColumns(tableId: string) {
  const queryClient = useQueryClient();
  const key = tableKeys.detail(tableId);
  return useMutation({
    mutationFn: (columnIds: string[]) => columnsApi.reorder(tableId, columnIds),
    onMutate: async (columnIds) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TableDetail>(key);
      if (previous) {
        const byId = new Map(previous.columns.map((column) => [column.id, column]));
        const columns = columnIds.flatMap((id, position) => {
          const column = byId.get(id);
          return column ? [{ ...column, position }] : [];
        });
        queryClient.setQueryData<TableDetail>(key, { ...previous, columns });
      }
      return { previous };
    },
    onError: (_error, _columnIds, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: () => refreshTable(queryClient, tableId),
  });
}
