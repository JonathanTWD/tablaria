import { columnDefinitionSchema, type PublicTable } from "@tablaria/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import PublicTablePage from "./PublicTablePage";

const NAME_ID = "1a2b3c4d-1111-4aaa-8bbb-000000000001";
const STOCK_ID = "1a2b3c4d-2222-4aaa-8bbb-000000000002";
const TOKEN = "b".repeat(43);

const column = (id: string, position: number, definition: object) => ({
  ...columnDefinitionSchema.parse(definition),
  id,
  position,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const shared: PublicTable = {
  name: "Almacén central",
  description: "Existencias por ubicación.",
  columns: [
    column(NAME_ID, 0, { name: "Producto", type: "text" }),
    column(STOCK_ID, 1, { name: "Cantidad", type: "number" }),
  ],
  records: {
    data: [
      {
        id: "r1",
        data: { [NAME_ID]: "Palés europeos", [STOCK_ID]: 12000 },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    meta: { page: 1, pageSize: 10, total: 1, pageCount: 1 },
  },
};

describe("PublicTablePage", () => {
  it("shows the shared table, sending the token in a header", async () => {
    const user = userEvent.setup();
    const requests: { url: URL; token: string | null }[] = [];
    mockApi((url, init) => {
      requests.push({ url, token: new Headers(init.headers).get("x-public-token") });
      return shared;
    });
    renderWithProviders(<PublicTablePage />, { route: `/p#${TOKEN}` });

    expect(await screen.findByRole("heading", { name: "Almacén central" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "12.000" })).toBeVisible();
    await user.type(screen.getByLabelText("Buscar en la tabla"), "palés");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => expect(requests.at(-1)?.url.searchParams.get("search")).toBe("palés"));
    expect(requests.every(({ url, token }) => token === TOKEN && !url.href.includes(TOKEN))).toBe(true);
  });

  it("says when the link doesn't work", async () => {
    mockApi(() => 404);
    renderWithProviders(<PublicTablePage />, { route: `/p#${TOKEN}` });

    expect(await screen.findByRole("heading", { name: "Este enlace no funciona" })).toBeVisible();
  });
});
