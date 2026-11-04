import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { MetricsSummary, RecordPage, TableRecord } from "@tablaria/shared";
import { metricsSummaryQuery } from "@/features/metrics/queries";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { mockApi } from "@/test/render";
import { recordsQuery, useUpdateRecord } from "./queries";
import { parseRecordsView } from "./records-view";

const TABLE = "table-1";
const record: TableRecord = {
  id: "record-1",
  data: { quantity: 5 },
  createdAt: "",
  updatedAt: "",
};

describe("useUpdateRecord", () => {
  it("saves an edit while the metrics of the same table are cached", async () => {
    const fetchMock = mockApi(() => ({ ...record, data: { quantity: 8 } }));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const page: RecordPage = {
      data: [record],
      meta: { page: 1, pageSize: 25, total: 1, pageCount: 1 },
      linked: {},
      labelledRelations: [],
      groups: [],
    };
    const summary: MetricsSummary = { total: 1, columns: [] };
    const pageKey = recordsQuery(TABLE, parseRecordsView(new URLSearchParams())).queryKey;
    queryClient.setQueryData(pageKey, page);
    queryClient.setQueryData(metricsSummaryQuery(TABLE).queryKey, summary);

    const { result } = renderHook(() => useUpdateRecord(TABLE), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate({ recordId: record.id, changes: { quantity: 8 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalled();
  });
});
