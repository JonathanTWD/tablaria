import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  Paginated,
  RecordData,
  RecordStatsQuery,
  TableRecord,
} from "@wisedata/shared";
import { tableKeys } from "@/features/tables/queries";
import { recordsApi } from "./api";
import type { RecordsView } from "./records-view";

export function recordsQuery(tableId: string, view: RecordsView) {
  return queryOptions({
    queryKey: [...tableKeys.records(tableId), view],
    queryFn: () => recordsApi.list(tableId, view),
    // Keeps the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
}

/** Under the table's records key, so every record change refreshes the charts too. */
export function recordStatsQuery(tableId: string, query: RecordStatsQuery) {
  return queryOptions({
    queryKey: [...tableKeys.records(tableId), "stats", query],
    queryFn: () => recordsApi.stats(tableId, query),
    // Keeps the current chart on screen while another grouping loads.
    placeholderData: keepPreviousData,
  });
}

/** Record counts and "last edited" live on the table, so they change too. */
function refreshAfterWrite(queryClient: QueryClient, tableId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: tableKeys.records(tableId) }),
    queryClient.invalidateQueries({ queryKey: tableKeys.detail(tableId) }),
    queryClient.invalidateQueries({ queryKey: tableKeys.list() }),
  ]);
}

export function useCreateRecord(tableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordData) => recordsApi.create(tableId, data),
    onSuccess: () => refreshAfterWrite(queryClient, tableId),
  });
}

export function useDeleteRecord(tableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) => recordsApi.remove(tableId, recordId),
    onSuccess: () => refreshAfterWrite(queryClient, tableId),
  });
}

function applyChanges(record: TableRecord, changes: RecordData): TableRecord {
  const data = { ...record.data, ...changes };
  for (const [columnId, value] of Object.entries(changes)) {
    if (value === null) {
      delete data[columnId];
    }
  }
  return { ...record, data };
}

/** Shows edits at once and puts the old values back if the API refuses them. */
export function useUpdateRecord(tableId: string) {
  const queryClient = useQueryClient();
  const key = tableKeys.records(tableId);

  return useMutation({
    mutationFn: ({ recordId, changes }: { recordId: string; changes: RecordData }) =>
      recordsApi.update(tableId, recordId, changes),
    onMutate: async ({ recordId, changes }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueriesData<Paginated<TableRecord>>({ queryKey: key });
      queryClient.setQueriesData<Paginated<TableRecord>>({ queryKey: key }, (page) =>
        page && {
          ...page,
          data: page.data.map((record) =>
            record.id === recordId ? applyChanges(record, changes) : record,
          ),
        },
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      for (const [queryKey, data] of context?.previous ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    // The edit may move the record out of the current sort or filter. Counts
    // don't change, so the table detail stays; the list shows "last edited".
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: tableKeys.list() }),
      ]),
  });
}
