import type { SavedView } from "@tablaria/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RecordsView } from "@/features/records/records-view";
import { mockApi, renderWithProviders } from "@/test/render";
import { SavedViewsMenu } from "./SavedViewsMenu";

const TABLE_ID = "6a7b8c9d-1111-4aaa-8bbb-000000000001";
const STOCK_ID = "6a7b8c9d-2222-4aaa-8bbb-000000000002";

const lowStock: SavedView = {
  id: "6a7b8c9d-3333-4aaa-8bbb-000000000003",
  name: "Bajo stock",
  view: {
    search: "",
    sort: STOCK_ID,
    order: "asc",
    filters: [{ columnId: STOCK_ID, op: "between", max: 5 }],
    pageSize: 10,
  },
  createdBy: "ana",
  createdAt: "",
  updatedAt: "",
};

const allRecords: RecordsView = {
  page: 3,
  pageSize: 10,
  search: "taladro",
  order: "asc",
  filters: [],
};

describe("SavedViewsMenu", () => {
  it("opens a saved view on its first page", async () => {
    mockApi(() => [lowStock]);
    const onOpen = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <SavedViewsMenu tableId={TABLE_ID} view={allRecords} canEdit={false} onOpen={onOpen} />,
    );

    await user.click(await screen.findByRole("button", { name: /Vistas/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Bajo stock/ }));
    expect(onOpen).toHaveBeenCalledWith({ ...lowStock.view, page: 1, group: undefined });
  });

  it("names the saved view on screen, whatever its page", async () => {
    mockApi(() => [lowStock]);
    renderWithProviders(
      <SavedViewsMenu
        tableId={TABLE_ID}
        view={{ ...lowStock.view, page: 2 }}
        canEdit={false}
        onOpen={() => undefined}
      />,
    );

    expect(await screen.findByRole("button", { name: /Bajo stock/ })).toBeVisible();
  });

  it("saves the current view with a name, without its page", async () => {
    const fetchMock = mockApi((_url, init) =>
      init.method === "POST" ? { ...lowStock, name: "Taladros" } : [],
    );
    const user = userEvent.setup();
    renderWithProviders(
      <SavedViewsMenu tableId={TABLE_ID} view={allRecords} canEdit onOpen={() => undefined} />,
    );

    await user.click(await screen.findByRole("button", { name: /Vistas/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Guardar la vista actual/ }));
    await user.type(await screen.findByLabelText("Nombre"), "Taladros");
    await user.click(screen.getByRole("button", { name: "Guardar vista" }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(JSON.parse(String(post?.[1]?.body))).toEqual({
        name: "Taladros",
        view: { search: "taladro", order: "asc", filters: [], pageSize: 10 },
      });
    });
  });

  it("is hidden from viewers when the table has no views", async () => {
    const fetchMock = mockApi(() => []);
    renderWithProviders(
      <SavedViewsMenu tableId={TABLE_ID} view={allRecords} canEdit={false} onOpen={() => undefined} />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Vistas/ })).not.toBeInTheDocument();
  });
});
