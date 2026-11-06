import {
  columnDefinitionSchema,
  type RecordDetail,
  type TableColumn,
  type TableDetail,
  type TableRecord,
} from "@tablaria/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecordSheet } from "@/features/records/RecordSheet";
import { mockApi, renderWithProviders } from "@/test/render";
import { QrCode } from "./QrCode";
import { labelLines, recordUrl } from "./record-label";

const TABLE_ID = "6a7b8c9d-1111-4aaa-8bbb-000000000001";
const RECORD_ID = "6a7b8c9d-2222-4aaa-8bbb-000000000002";

function column(id: string, position: number, definition: object): TableColumn {
  return {
    ...columnDefinitionSchema.parse(definition),
    id,
    position,
    createdAt: "",
    updatedAt: "",
  };
}

const name = column("name", 0, { name: "Producto", type: "text" });
const sku = column("sku", 1, { name: "Referencia", type: "text", unique: true });
const price = column("price", 2, { name: "Precio", type: "currency", options: { currency: "EUR" } });
const drill: TableRecord = {
  id: RECORD_ID,
  data: { name: "Taladro percutor", sku: "TL-750", price: 89.9 },
  createdAt: "",
  updatedAt: "",
};

describe("QR labels", () => {
  it("lead to the record in its table and print its name and reference", () => {
    expect(recordUrl(TABLE_ID, RECORD_ID)).toBe(
      `${window.location.origin}/app/tables/${TABLE_ID}?record=${RECORD_ID}`,
    );
    expect(labelLines([name, sku, price], drill)).toEqual({
      name: "Taladro percutor",
      reference: "TL-750",
    });
    // Without a unique column there is no reference to print.
    expect(labelLines([name, price], drill).reference).toBeNull();
  });

  it("draws the code as an image screen readers can name", () => {
    render(<QrCode value="https://tablaria.es" label="Código QR de Taladro" />);

    const code = screen.getByRole("img", { name: "Código QR de Taladro" });
    expect(code.querySelector("path")?.getAttribute("d")).toMatch(/^M\d+ \d+h1v1h-1z/);
  });
});

describe("RecordSheet", () => {
  it("shows every cell of the record with its label, and offers to edit it", async () => {
    const detail: RecordDetail = { record: drill, linked: {} };
    mockApi(() => detail);
    const onEdit = vi.fn();
    const table = {
      id: TABLE_ID,
      name: "Productos",
      columns: [name, sku, price],
      lookupTargets: {},
      rollupTargets: {},
    } as unknown as TableDetail;
    renderWithProviders(
      <RecordSheet table={table} recordId={RECORD_ID} onClose={() => undefined} onEdit={onEdit} />,
    );

    expect(await screen.findByRole("img", { name: "Código QR de Taladro percutor" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Taladro percutor" })).toBeVisible();
    expect(screen.getByText("Referencia")).toBeVisible();
    expect(screen.getByText(/89,90\s€/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Imprimir etiqueta" })).toHaveAttribute(
      "href",
      `/app/tables/${TABLE_ID}/labels?record=${RECORD_ID}`,
    );
    screen.getByRole("button", { name: "Editar en formulario" }).click();
    expect(onEdit).toHaveBeenCalledWith(drill);
  });
});
