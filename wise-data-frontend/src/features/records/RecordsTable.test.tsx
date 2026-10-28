import {
  columnDefinitionSchema,
  type Paginated,
  type TableColumn,
  type TableDetail,
  type TableRecord,
} from "@wisedata/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import { RecordsTable } from "./RecordsTable";

const NAME_ID = "1c9e7d3f-2b3c-4d4e-9f0a-1b2c3d4e5f60";
const PRICE_ID = "0b8d6c2e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

function column(id: string, position: number, definition: object): TableColumn {
  return {
    ...columnDefinitionSchema.parse(definition),
    id,
    position,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const table: TableDetail = {
  id: "2d0f8e4a-3c4d-4e5f-8a0b-2c3d4e5f6071",
  name: "Productos",
  description: null,
  columnCount: 2,
  recordCount: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  columns: [
    column(NAME_ID, 0, { name: "Nombre", type: "text" }),
    column(PRICE_ID, 1, { name: "Precio", type: "currency", options: { currency: "EUR" } }),
  ],
};

const page: Paginated<TableRecord> = {
  data: [
    {
      id: "3e1a9f5b-4d5e-4f60-9b1c-3d4e5f607182",
      data: { [NAME_ID]: "Taladro", [PRICE_ID]: 89.9 },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  meta: { page: 1, pageSize: 25, total: 1, pageCount: 1 },
};

/** Query strings of the record listings the table requested. */
function listRequests(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname.endsWith("/records"))
    .map((url) => url.searchParams);
}

describe("RecordsTable", () => {
  it("keeps the sort in the URL and asks the API for it", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi(() => page);
    renderWithProviders(<RecordsTable table={table} />, { route: "/app/tables/x" });

    // Exact name: the cells' buttons ("Precio de Taladro: …") contain it too.
    await user.click(await screen.findByRole("button", { name: "Precio" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        `/app/tables/x?sort=${PRICE_ID}&order=asc`,
      ),
    );
    await waitFor(() =>
      expect(listRequests(fetchMock).at(-1)?.get("sort")).toBe(PRICE_ID),
    );
    expect(screen.getByRole("columnheader", { name: /Precio/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("restores search and filters from the URL and shows them", async () => {
    const filters = [{ columnId: PRICE_ID, op: "between", min: 10 }];
    const fetchMock = mockApi(() => page);
    renderWithProviders(<RecordsTable table={table} />, {
      route: `/app/tables/x?q=tala&filters=${encodeURIComponent(JSON.stringify(filters))}`,
    });

    expect(await screen.findByRole("searchbox", { name: "Buscar registros" })).toHaveValue("tala");
    expect(screen.getByText("Precio ≥ 10,00 €")).toBeInTheDocument();
    await waitFor(() => {
      const request = listRequests(fetchMock).at(-1);
      expect(request?.get("search")).toBe("tala");
      expect(JSON.parse(request?.get("filters") ?? "[]")).toEqual(filters);
    });
  });

  it("writes the search to the URL once the user stops typing", async () => {
    const user = userEvent.setup();
    mockApi(() => page);
    renderWithProviders(<RecordsTable table={table} />, { route: "/app/tables/x" });

    await user.type(await screen.findByRole("searchbox", { name: "Buscar registros" }), "tal");

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/app/tables/x?q=tal"),
    );
  });

  it("exports the current view without pagination", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi(() => page);
    // jsdom has no object URLs; a subclass keeps the real URL untouched for other tests.
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = () => "blob:x";
        static revokeObjectURL = () => {};
      },
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderWithProviders(<RecordsTable table={table} />, {
      route: `/app/tables/x?q=tala&page=2&sort=${PRICE_ID}&order=desc`,
    });

    await user.click(await screen.findByRole("button", { name: "Exportar CSV" }));

    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    const exportUrl = fetchMock.mock.calls
      .map(([input]) => new URL(String(input), "http://localhost"))
      .find((url) => url.pathname.endsWith("/records/export"));
    expect(Object.fromEntries(exportUrl?.searchParams ?? [])).toEqual({
      search: "tala",
      sort: PRICE_ID,
      order: "desc",
      format: "csv",
    });
    click.mockRestore();
  });
});
