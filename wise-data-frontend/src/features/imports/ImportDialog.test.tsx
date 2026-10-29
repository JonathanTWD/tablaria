import { columnDefinitionSchema, type ImportCheck, type TableColumn, type TableDetail } from "@wisedata/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import { ImportDialog } from "./ImportDialog";

const PRODUCT_ID = "1a2b3c4d-1111-4aaa-8bbb-000000000001";
const STOCK_ID = "1a2b3c4d-2222-4aaa-8bbb-000000000002";

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
  name: "Almacén",
  description: null,
  role: "EDITOR",
  organizationId: "5b6c7d8e-1111-4aaa-8bbb-000000000009",
  member: true,
  columnCount: 2,
  recordCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  columns: [
    column(PRODUCT_ID, 0, { name: "Producto", type: "text" }),
    column(STOCK_ID, 1, { name: "Stock", type: "number" }),
  ],
};

function csvFile(text: string) {
  return new File([text], "inventario.csv", { type: "text/csv" });
}

describe("ImportDialog", () => {
  it("matches columns by name, checks the file and imports it", async () => {
    const user = userEvent.setup();
    const sent: { path: string; body: unknown }[] = [];
    mockApi((url, init) => {
      sent.push({ path: url.pathname, body: JSON.parse(String(init.body)) });
      if (url.pathname.endsWith("/import/check")) {
        return {
          rows: 2,
          validRows: 2,
          errorCount: 0,
          errors: [],
          missingChoices: [],
          missingRequired: [],
        } satisfies ImportCheck;
      }
      return { tableId: table.id, imported: 2, addedChoices: 0, addedColumns: 0 };
    });
    renderWithProviders(<ImportDialog destination={{ kind: "table", table }} open onOpenChange={() => undefined} />);

    await user.upload(
      screen.getByLabelText("Archivo CSV"),
      csvFile("Producto;Notas;Stock\r\nTaladro;nuevo;5\r\nSierra;;1,5\r\n"),
    );
    expect(await screen.findByText("inventario.csv: 2 filas de datos.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(await screen.findByRole("status")).toHaveTextContent("2 registros listos para importar.");
    await user.click(screen.getByRole("button", { name: "Importar 2 registros" }));

    await waitFor(() => expect(sent).toHaveLength(2));
    const body = {
      columns: [PRODUCT_ID, null, STOCK_ID],
      rows: [
        ["Taladro", "nuevo", "5"],
        ["Sierra", "", "1,5"],
      ],
      addMissingChoices: false,
    };
    expect(sent).toEqual([
      { path: `/api/tables/${table.id}/import/check`, body },
      { path: `/api/tables/${table.id}/import`, body },
    ]);
  });

  it("lists the errors with the file's row numbers and blocks the import", async () => {
    const user = userEvent.setup();
    mockApi(() => ({
      rows: 2,
      validRows: 1,
      errorCount: 1,
      errors: [{ row: 2, column: 1, value: "12 uds", reason: "invalid" }],
      missingChoices: [],
      missingRequired: [],
    }));
    renderWithProviders(<ImportDialog destination={{ kind: "table", table }} open onOpenChange={() => undefined} />);

    await user.upload(screen.getByLabelText("Archivo CSV"), csvFile("Producto;Stock\nTaladro;5\nSierra;12 uds\n"));
    await user.click(await screen.findByRole("button", { name: "Comprobar" }));

    // Row 2 of the data is line 3 of the file, after the header.
    expect(await screen.findByText(/Fila 3 · Stock: «12 uds»/)).toBeVisible();
    expect(screen.getByText("no es un número")).toBeVisible();
    expect(screen.getByRole("button", { name: "Importar 1 registro" })).toBeDisabled();
  });

  it("creates a new table with columns typed from the file", async () => {
    const user = userEvent.setup();
    const sent: { path: string; body: unknown }[] = [];
    const organizationId = "5b6c7d8e-1111-4aaa-8bbb-000000000009";
    mockApi((url, init) => {
      sent.push({ path: url.pathname, body: JSON.parse(String(init.body)) });
      if (url.pathname.endsWith("/check")) {
        return {
          rows: 2,
          validRows: 2,
          errorCount: 0,
          errors: [],
          missingChoices: [],
          missingRequired: [],
        } satisfies ImportCheck;
      }
      return { tableId: "new-table", imported: 2, addedChoices: 0, addedColumns: 3 };
    });
    renderWithProviders(
      <ImportDialog destination={{ kind: "newTable", organizationId }} open onOpenChange={() => undefined} />,
    );

    await user.upload(
      screen.getByLabelText("Archivo CSV"),
      csvFile("Producto;Precio;Compra\nTaladro;89,90 €;15/03/2025\nSierra;12 €;2025-02-01\n"),
    );
    // Named after the file, with every column new and typed from its values.
    expect(await screen.findByLabelText("Nombre de la tabla")).toHaveValue("inventario");
    expect(screen.getByText("Se creará la columna «Precio»")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Comprobar" }));
    await user.click(await screen.findByRole("button", { name: "Importar 2 registros" }));

    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]).toMatchObject({
      path: `/api/organizations/${organizationId}/tables/import`,
      body: {
        name: "inventario",
        columns: [
          { create: { name: "Producto", type: "text" } },
          { create: { name: "Precio", type: "currency", options: { currency: "EUR" } } },
          { create: { name: "Compra", type: "date" } },
        ],
      },
    });
    expect(screen.getByTestId("location")).toHaveTextContent("/app/tables/new-table");
  });
});

