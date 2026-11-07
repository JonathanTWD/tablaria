import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SavedView, SavedViewInput, SavedViewQuery, SavedViewUpdate } from "@tablaria/shared";
import { tableKeys } from "@/features/tables/queries";
import type { RecordsView } from "@/features/records/records-view";
import { apiRequest } from "@/lib/api-client";

const viewsPath = (tableId: string) => `/tables/${tableId}/views`;

export function savedViewsQuery(tableId: string) {
  return queryOptions({
    queryKey: tableKeys.views(tableId),
    queryFn: () => apiRequest<SavedView[]>(viewsPath(tableId)),
  });
}

function useRefreshViews(tableId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: tableKeys.views(tableId) });
}

export function useCreateSavedView(tableId: string) {
  const refresh = useRefreshViews(tableId);
  return useMutation({
    mutationFn: (input: SavedViewInput) =>
      apiRequest<SavedView>(viewsPath(tableId), { method: "POST", body: input }),
    onSuccess: refresh,
  });
}

export function useUpdateSavedView(tableId: string) {
  const refresh = useRefreshViews(tableId);
  return useMutation({
    mutationFn: ({ viewId, changes }: { viewId: string; changes: SavedViewUpdate }) =>
      apiRequest<SavedView>(`${viewsPath(tableId)}/${viewId}`, { method: "PATCH", body: changes }),
    onSuccess: refresh,
  });
}

export function useDeleteSavedView(tableId: string) {
  const refresh = useRefreshViews(tableId);
  return useMutation({
    mutationFn: (viewId: string) =>
      apiRequest<void>(`${viewsPath(tableId)}/${viewId}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

/**
 * What a saved view keeps of the table's view: everything but the page. The
 * order only counts with a sort, as in the URL, so equal views compare equal.
 */
export function toSavedQuery(view: RecordsView): SavedViewQuery {
  return {
    search: view.search,
    ...(view.sort && { sort: view.sort }),
    order: view.sort ? view.order : "asc",
    filters: view.filters,
    ...(view.group && { group: view.group }),
    pageSize: view.pageSize,
  };
}

/** The table's view a saved one opens, on its first page. */
export function viewFromSaved(saved: SavedViewQuery): RecordsView {
  return {
    page: 1,
    search: saved.search,
    sort: saved.sort,
    order: saved.order,
    filters: saved.filters,
    group: saved.group,
    pageSize: saved.pageSize,
  };
}

/** Whether the table shows exactly what the saved view keeps. */
export function sameView(saved: SavedViewQuery, current: RecordsView): boolean {
  return (
    JSON.stringify(toSavedQuery(viewFromSaved(saved))) === JSON.stringify(toSavedQuery(current))
  );
}
