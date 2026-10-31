import { columnDefinitionSchema, type TableColumn, type TableDetail } from "@tablaria/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import { ColumnDialog } from "./ColumnDialog";

const ORGANIZATION_ID = "5b6c7d8e-1111-4aaa-8bbb-000000000009";
const PRODUCTS_ID = "2d0f8e4a-3c4d-4e5f-8a0b-2c3d4e5f6071";
const SUPPLIERS_ID = "6a7b8c9d-1111-4aaa-8bbb-000000000004";

function column(id: string, position: number, definition: object): TableColumn {
  return {
    ...columnDefinitionSchema.parse(definition),
    id,
    position,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function table(id: string, name: string, columns: TableColumn[]): TableDetail {
  return {
    id,
    name,
    description: null,
    role: "OWNER",
    organizationId: ORGANIZATION_ID,
    member: true,
    columnCount: columns.length,
    recordCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    columns,
    lookupTargets: {},
  };
}

const supplier = column("1a2b3c4d-1111-4aaa-8bbb-000000000001", 1, {
  name: "Proveedor",
  type: "relation",
  options: { tableId: SUPPLIERS_ID },
});

describe("ColumnDialog", () => {
  it("says which column of the linked table names its records", async () => {
    // "Ciudad" is listed first but "Nombre" holds the first position.
    const suppliers = table(SUPPLIERS_ID, "Proveedores", [
      column("1a2b3c4d-2222-4aaa-8bbb-000000000002", 1, { name: "Ciudad", type: "text" }),
      column("1a2b3c4d-3333-4aaa-8bbb-000000000003", 0, { name: "Nombre", type: "text" }),
    ]);
    const products = table(PRODUCTS_ID, "Productos", [supplier]);
    mockApi((url) => {
      if (url.pathname.endsWith(`/tables/${SUPPLIERS_ID}`)) {
        return suppliers;
      }
      if (url.pathname.endsWith(`/tables/${PRODUCTS_ID}`)) {
        return products;
      }
      return [suppliers, products];
    });
    renderWithProviders(
      <ColumnDialog tableId={PRODUCTS_ID} column={supplier} recordCount={0} open onOpenChange={() => undefined} />,
    );

    expect(
      await screen.findByText(
        "Se verá «Nombre», la primera columna de Proveedores. Para mostrar otra, súbela a la primera posición en esa tabla.",
      ),
    ).toBeVisible();
  });

  it("creates a lookup from a relation and a column of the linked table", async () => {
    const user = userEvent.setup();
    const phone = column("1a2b3c4d-4444-4aaa-8bbb-000000000004", 1, { name: "Teléfono", type: "text" });
    const suppliers = table(SUPPLIERS_ID, "Proveedores", [
      column("1a2b3c4d-3333-4aaa-8bbb-000000000003", 0, { name: "Nombre", type: "text" }),
      phone,
    ]);
    const products = table(PRODUCTS_ID, "Productos", [supplier]);
    const sent: unknown[] = [];
    mockApi((url, init) => {
      if (init.method === "POST") {
        sent.push(JSON.parse(String(init.body)));
        return { ...supplier, id: "1a2b3c4d-5555-4aaa-8bbb-000000000005" };
      }
      if (url.pathname.endsWith(`/tables/${SUPPLIERS_ID}`)) {
        return suppliers;
      }
      if (url.pathname.endsWith(`/tables/${PRODUCTS_ID}`)) {
        return products;
      }
      return [suppliers, products];
    });
    renderWithProviders(
      <ColumnDialog tableId={PRODUCTS_ID} recordCount={0} open onOpenChange={() => undefined} />,
    );

    await user.type(screen.getByLabelText("Nombre"), "Teléfono del proveedor");
    await user.click(screen.getByLabelText("Tipo"));
    await user.click(await screen.findByRole("option", { name: /Consulta de otra tabla/ }));
    await user.click(await screen.findByLabelText("A través de la relación"));
    await user.click(await screen.findByRole("option", { name: "Proveedor" }));
    await user.click(screen.getByLabelText("Dato que se muestra"));
    await user.click(await screen.findByRole("option", { name: "Teléfono" }));
    expect(screen.queryByLabelText("Obligatoria")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Añadir columna" }));

    await waitFor(() =>
      expect(sent).toEqual([
        expect.objectContaining({
          name: "Teléfono del proveedor",
          type: "lookup",
          required: false,
          options: { relationColumnId: supplier.id, targetColumnId: phone.id },
          defaultValue: null,
        }),
      ]),
    );
  });
});
