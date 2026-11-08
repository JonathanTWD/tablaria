import {
  columnDefinitionSchema,
  type Paginated,
  type TableColumn,
  type TableDetail,
  type TableRecord,
} from "@tablaria/shared";
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
  role: "OWNER",
  organizationId: "5b6c7d8e-1111-4aaa-8bbb-000000000009",
  member: true,
  columnCount: 2,
  recordCount: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  lookupTargets: {},
  rollupTargets: {},
  incomingRelations: [],
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

/** The API for the table: no saved views, and `handler` for everything else. */
function mockTableApi(handler: Parameters<typeof mockApi>[0]) {
  return mockApi((url, init) => (url.pathname.endsWith("/views") ? [] : handler(url, init)));
}

/** Query strings of the record listings the table requested. */
function listRequests(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname.endsWith("/records"))
    .map((url) => url.searchParams);
}

describe("RecordsTable", () => {
  it("shows rollups read-only: a count as a number, a sum like the column it adds up", async () => {
    const COUNT_ID = "4f5a6b7c-4444-4aaa-8bbb-000000000008";
    const SUM_ID = "4f5a6b7c-5555-4aaa-8bbb-000000000009";
    const salary = column("6a7b8c9d-3333-4aaa-8bbb-000000000010", 1, {
      name: "Salario",
      type: "currency",
      options: { currency: "EUR" },
    });
    const options = (fn: string, targetColumnId: string | null) => ({
      relationColumnId: "6a7b8c9d-4444-4aaa-8bbb-000000000011",
      function: fn,
      targetColumnId,
    });
    const withRollups: TableDetail = {
      ...table,
      columns: [
        ...table.columns,
        column(COUNT_ID, 2, { name: "Personas", type: "rollup", options: options("count", null) }),
        column(SUM_ID, 3, { name: "Coste", type: "rollup", options: options("sum", salary.id) }),
      ],
      rollupTargets: { [COUNT_ID]: null, [SUM_ID]: salary },
    };
    mockTableApi(() => ({
      ...page,
      data: [{ ...page.data[0], data: { ...page.data[0].data, [COUNT_ID]: 12, [SUM_ID]: 25400 } }],
      linked: {},
      labelledRelations: [],
      groups: [],
    }));
    renderWithProviders(<RecordsTable table={withRollups} />, { route: "/app/tables/x" });

    expect(await screen.findByText("12")).toBeVisible();
    expect(screen.getByText("25.400,00 €")).toBeVisible();
    // Sorted by its value (ADR-034): the header is a button.
    expect(screen.getByRole("button", { name: "Personas" })).toBeVisible();
  });

  it("shows a lookup read-only, formatted like the column it shows", async () => {
    const LEAD_ID = "4f5a6b7c-3333-4aaa-8bbb-000000000006";
    const SUPPLIER_ID = "4f5a6b7c-1111-4aaa-8bbb-000000000003";
    const days = column("6a7b8c9d-2222-4aaa-8bbb-000000000007", 1, { name: "Plazo", type: "currency", options: { currency: "EUR" } });
    const withLookup: TableDetail = {
      ...table,
      columns: [
        ...table.columns,
        column(SUPPLIER_ID, 2, {
          name: "Proveedor",
          type: "relation",
          options: { tableId: "6a7b8c9d-1111-4aaa-8bbb-000000000004" },
        }),
        column(LEAD_ID, 3, {
          name: "Coste de envío",
          type: "lookup",
          options: { relationColumnId: SUPPLIER_ID, targetColumnId: days.id },
        }),
      ],
      lookupTargets: { [LEAD_ID]: days },
    };
    mockTableApi(() => ({
      ...page,
      data: [{ ...page.data[0], data: { ...page.data[0].data, [LEAD_ID]: 4.5 } }],
      linked: {},
      labelledRelations: [],
      groups: [],
    }));
    renderWithProviders(<RecordsTable table={withLookup} />, { route: "/app/tables/x" });

    // Formatted as the currency it shows, and not an editable cell.
    expect(await screen.findByText("4,50 €")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Coste de envío de Taladro/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coste de envío" })).toBeVisible();
  });

  it("shows a header with the size of each group", async () => {
    const STATUS_ID = "4f5a6b7c-2222-4aaa-8bbb-000000000005";
    const grouped: TableDetail = {
      ...table,
      columns: [
        ...table.columns,
        column(STATUS_ID, 2, {
          name: "Estado",
          type: "select",
          options: {
            choices: [
              { id: "d", label: "Disponible", color: "green" },
              { id: "a", label: "Agotado", color: "red" },
            ],
          },
        }),
      ],
    };
    const record = (id: string, name: string, status: string | null) => ({
      id,
      data: { [NAME_ID]: name, ...(status && { [STATUS_ID]: status }) },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const fetchMock = mockTableApi(() => ({
      data: [
        record("3e1a9f5b-0000-4f60-9b1c-000000000001", "Sierra", "Disponible"),
        record("3e1a9f5b-0000-4f60-9b1c-000000000002", "Cinta", "Disponible"),
        record("3e1a9f5b-0000-4f60-9b1c-000000000003", "Taladro", "Agotado"),
        record("3e1a9f5b-0000-4f60-9b1c-000000000004", "Martillo", null),
      ],
      meta: { page: 1, pageSize: 25, total: 4, pageCount: 1 },
      linked: {},
      labelledRelations: [],
      groups: [
        { value: "Disponible", count: 2 },
        { value: "Agotado", count: 1 },
        { value: null, count: 1 },
      ],
    }));
    renderWithProviders(<RecordsTable table={grouped} />, {
      route: `/app/tables/x?group=${STATUS_ID}`,
    });

    const headers = await screen.findAllByRole("columnheader", { name: /^Estado: / });
    expect(headers.map((header) => header.textContent)).toEqual([
      "Estado: Disponible · 2 registros",
      "Estado: Agotado · 1 registro",
      "Estado: sin valor · 1 registro",
    ]);
    expect(listRequests(fetchMock).at(-1)?.get("group")).toBe(STATUS_ID);
  });

  it("sorts relations by name only when their table can be opened", async () => {
    const SUPPLIER_ID = "4f5a6b7c-1111-4aaa-8bbb-000000000003";
    const withSupplier: TableDetail = {
      ...table,
      columns: [
        ...table.columns,
        column(SUPPLIER_ID, 2, {
          name: "Proveedor",
          type: "relation",
          options: { tableId: "6a7b8c9d-1111-4aaa-8bbb-000000000004" },
        }),
      ],
    };
    mockTableApi(() => ({ ...page, linked: {}, labelledRelations: [SUPPLIER_ID] }));
    const { unmount } = renderWithProviders(<RecordsTable table={withSupplier} />, {
      route: "/app/tables/x",
    });
    expect(await screen.findByRole("button", { name: "Proveedor" })).toBeVisible();
    unmount();

    mockTableApi(() => ({ ...page, linked: {}, labelledRelations: [] }));
    renderWithProviders(<RecordsTable table={withSupplier} />, { route: "/app/tables/x" });
    expect(await screen.findByRole("button", { name: "Precio" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Proveedor" })).not.toBeInTheDocument();
  });

  it("keeps the sort in the URL and asks the API for it", async () => {
    const user = userEvent.setup();
    const fetchMock = mockTableApi(() => page);
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
    const fetchMock = mockTableApi(() => page);
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
    mockTableApi(() => page);
    renderWithProviders(<RecordsTable table={table} />, { route: "/app/tables/x" });

    await user.type(await screen.findByRole("searchbox", { name: "Buscar registros" }), "tal");

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/app/tables/x?q=tal"),
    );
  });

  it("exports the current view without pagination", async () => {
    const user = userEvent.setup();
    const fetchMock = mockTableApi(() => page);
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

    await user.click(await screen.findByRole("button", { name: "Exportar" }));
    await user.click(await screen.findByRole("menuitem", { name: "CSV (.csv)" }));

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

  it("shows viewers the records without any way to change them", async () => {
    const user = userEvent.setup();
    mockTableApi(() => page);
    renderWithProviders(<RecordsTable table={{ ...table, role: "VIEWER" }} />, {
      route: "/app/tables/x",
    });

    expect(await screen.findByText("Taladro")).toBeInTheDocument();
    expect(screen.getByText(/Solo lectura/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nuevo registro/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Precio de Taladro/ })).not.toBeInTheDocument();
    // Exporting and printing labels are reading, so viewers keep them.
    expect(screen.getByRole("button", { name: /Exportar/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Etiquetas QR/ })).toBeInTheDocument();
    // A record's menu only opens its sheet (ADR-038).
    await user.click(screen.getByRole("button", { name: /Acciones/ }));
    expect(await screen.findByRole("menuitem", { name: "Ver ficha" })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: /Editar|Eliminar/ })).not.toBeInTheDocument();
  });

  it("lets editors change records", async () => {
    mockTableApi(() => page);
    renderWithProviders(<RecordsTable table={{ ...table, role: "EDITOR" }} />, {
      route: "/app/tables/x",
    });

    expect(await screen.findByRole("button", { name: /Precio de Taladro/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nuevo registro/ })).toBeInTheDocument();
    expect(screen.queryByText(/Solo lectura/)).not.toBeInTheDocument();
  });

  it("changes a value in the ticked records at once", async () => {
    const user = userEvent.setup();
    const saw = {
      ...page.data[0],
      id: "3e1a9f5b-4d5e-4f60-9b1c-3d4e5f607183",
      data: { [NAME_ID]: "Sierra", [PRICE_ID]: 74 },
    };
    const fetchMock = mockTableApi((_url, init) =>
      init.method === "PATCH" ? { count: 2 } : { ...page, data: [...page.data, saw] },
    );
    renderWithProviders(<RecordsTable table={{ ...table, role: "EDITOR" }} />, {
      route: "/app/tables/x",
    });

    await user.click(await screen.findByRole("checkbox", { name: "Seleccionar Taladro" }));
    expect(screen.getByRole("checkbox", { name: /todos los registros/ })).toHaveProperty("indeterminate", true);
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar Sierra" }));
    const toolbar = screen.getByRole("toolbar", { name: /registros seleccionados/ });
    expect(toolbar).toHaveTextContent("2 registros seleccionados");

    await user.click(screen.getByRole("button", { name: "Cambiar un valor" }));
    await user.type(await screen.findByLabelText("Nuevo valor"), "Sin nombre");
    await user.click(screen.getByRole("button", { name: "Cambiar 2 registros" }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(String(patch?.[0])).toBe(`/api/tables/${table.id}/records/batch`);
      expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
        ids: [page.data[0].id, saw.id],
        data: { [NAME_ID]: "Sin nombre" },
      });
    });
    // Done: the selection is cleared.
    await waitFor(() => expect(screen.queryByRole("toolbar")).not.toBeInTheDocument());
  });

  it("offers no selection to viewers", async () => {
    mockTableApi(() => page);
    renderWithProviders(<RecordsTable table={{ ...table, role: "VIEWER" }} />, {
      route: "/app/tables/x",
    });

    expect(await screen.findByText("Taladro")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("keeps export, labels and import one click away in the «Más» menu", async () => {
    const user = userEvent.setup();
    mockTableApi(() => page);
    renderWithProviders(<RecordsTable table={{ ...table, role: "EDITOR" }} />, {
      route: "/app/tables/x",
    });

    await user.click(await screen.findByRole("button", { name: "Más acciones" }));
    expect(await screen.findByRole("menuitem", { name: "Exportar a Excel" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Exportar a CSV" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Etiquetas QR" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Importar" })).toBeVisible();
  });
});
