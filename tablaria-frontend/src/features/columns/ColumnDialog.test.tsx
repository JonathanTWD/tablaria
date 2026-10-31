import { columnDefinitionSchema, type TableColumn, type TableDetail } from "@tablaria/shared";
import { screen } from "@testing-library/react";
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
});
