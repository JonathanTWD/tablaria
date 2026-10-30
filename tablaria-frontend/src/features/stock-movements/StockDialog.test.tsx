import {
  columnDefinitionSchema,
  type StockHistory,
  type StockMovement,
  type TableColumn,
  type TableRecord,
} from "@tablaria/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import { StockDialog } from "./StockDialog";

const STOCK_ID = "1a2b3c4d-1111-4aaa-8bbb-000000000001";

const stock: TableColumn = {
  ...columnDefinitionSchema.parse({ name: "Stock", type: "number", stock: true }),
  id: STOCK_ID,
  position: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const record: TableRecord = {
  id: "3e1a9f5b-4d5e-4f60-9b1c-3d4e5f607182",
  data: { [STOCK_ID]: 14 },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function movement(fields: Partial<StockMovement>): StockMovement {
  return {
    id: crypto.randomUUID(),
    recordId: record.id,
    columnId: STOCK_ID,
    kind: "count",
    delta: 14,
    balance: 14,
    note: "Inventario inicial",
    by: null,
    createdAt: "2026-10-30T10:35:00.000Z",
    ...fields,
  };
}

describe("StockDialog", () => {
  it("records goods in, previews the stock and shows the history", async () => {
    const user = userEvent.setup();
    const sent: unknown[] = [];
    let history: StockHistory = { data: [movement({})], total: 1 };
    mockApi((url, init) => {
      if (init.method === "POST") {
        sent.push(JSON.parse(String(init.body)));
        const added = movement({ kind: "in", delta: 6, balance: 20, note: "Pedido 1024", by: "ana" });
        history = { data: [added, ...history.data], total: 2 };
        return { movement: added, record: { ...record, data: { [STOCK_ID]: 20 } } };
      }
      if (url.pathname.endsWith("/movements")) {
        return history;
      }
      return { data: [], meta: { page: 1, pageSize: 10, total: 0, pageCount: 0 }, linked: {} };
    });
    renderWithProviders(
      <StockDialog
        tableId="table-1"
        record={record}
        label="Taladro"
        columns={[stock]}
        canEdit
        onOpenChange={() => undefined}
      />,
    );

    expect(await screen.findByText("Inventario inicial")).toBeVisible();
    await user.type(screen.getByLabelText("Unidades que entran"), "6");
    expect(screen.getByText("El stock pasará a 20.")).toBeVisible();
    await user.type(screen.getByLabelText("Nota (opcional)"), "Pedido 1024");
    await user.click(screen.getByRole("button", { name: "Anotar entrada" }));

    await waitFor(() =>
      expect(sent).toEqual([{ columnId: STOCK_ID, kind: "in", quantity: 6, note: "Pedido 1024" }]),
    );
    expect(await screen.findByText("Pedido 1024")).toBeVisible();
    expect(screen.getByText("+6")).toBeVisible();
    // Ready for the next movement.
    await waitFor(() => expect(screen.getByLabelText("Unidades que entran")).toHaveValue(""));
  });

  it("explains a goods out larger than the stock", async () => {
    const user = userEvent.setup();
    mockApi((_url, init) => (init.method === "POST" ? 422 : { data: [], total: 0 }));
    renderWithProviders(
      <StockDialog
        tableId="table-1"
        record={record}
        label="Taladro"
        columns={[stock]}
        canEdit
        onOpenChange={() => undefined}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Salida" }));
    await user.type(screen.getByLabelText("Unidades que salen"), "20");
    expect(screen.getByText("No hay tanto stock: quedan 14.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Anotar salida" }));
    expect(await screen.findByText("No hay tanto stock: quedan 14.")).toBeVisible();
    expect(screen.getByLabelText("Unidades que salen")).toHaveFocus();
  });

  it("only shows the history to viewers", async () => {
    mockApi(() => ({ data: [movement({})], total: 1 }));
    renderWithProviders(
      <StockDialog
        tableId="table-1"
        record={record}
        label="Taladro"
        columns={[stock]}
        canEdit={false}
        onOpenChange={() => undefined}
      />,
    );

    expect(await screen.findByText("Inventario inicial")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Anotar/ })).not.toBeInTheDocument();
  });
});
