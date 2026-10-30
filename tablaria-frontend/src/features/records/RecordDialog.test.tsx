import { columnDefinitionSchema, type TableColumn, type TableRecord } from "@tablaria/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import { RecordDialog } from "./RecordDialog";

const NAME_ID = "1a2b3c4d-1111-4aaa-8bbb-000000000001";
const PRICE_ID = "1a2b3c4d-2222-4aaa-8bbb-000000000002";

function column(id: string, position: number, definition: object): TableColumn {
  return {
    ...columnDefinitionSchema.parse(definition),
    id,
    position,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const columns = [
  column(NAME_ID, 0, { name: "Nombre", type: "text" }),
  column(PRICE_ID, 1, { name: "Precio", type: "number" }),
];

const record: TableRecord = {
  id: "3e1a9f5b-4d5e-4f60-9b1c-3d4e5f607182",
  data: { [NAME_ID]: "Cajas", [PRICE_ID]: 10 },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("RecordDialog", () => {
  it("sends only the fields the user changed, so others' edits survive", async () => {
    const user = userEvent.setup();
    const sent: unknown[] = [];
    mockApi((_url, init) => {
      if (init.method === "PATCH") {
        sent.push(JSON.parse(String(init.body)));
      }
      return record;
    });
    renderWithProviders(
      <RecordDialog
        tableId="table-1"
        columns={columns}
        record={record}
        editingBy={["luis"]}
        open
        onOpenChange={() => undefined}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/luis está editando/);
    const name = screen.getByLabelText(/Nombre/);
    await user.clear(name);
    await user.type(name, "Cajas grandes");
    await user.click(screen.getByRole("button", { name: /Guardar/ }));

    // Price untouched: someone else may have changed it meanwhile.
    await waitFor(() => expect(sent).toEqual([{ data: { [NAME_ID]: "Cajas grandes" } }]));
  });

  it("marks the field whose value another record holds in a unique column", async () => {
    const user = userEvent.setup();
    mockApi(
      () =>
        new Response(
          JSON.stringify({
            statusCode: 409,
            error: "Conflict",
            message: "Value already used in a unique column",
            details: [{ path: NAME_ID, message: "Cajas" }],
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
    );
    renderWithProviders(
      <RecordDialog tableId="table-1" columns={columns} open onOpenChange={() => undefined} />,
    );

    await user.type(screen.getByLabelText(/Nombre/), "Cajas");
    await user.click(screen.getByRole("button", { name: /Añadir|Crear|Guardar/ }));

    expect(
      await screen.findByText("Otro registro ya tiene este valor, y esta columna no admite repetidos."),
    ).toBeVisible();
    expect(screen.getByLabelText(/Nombre/)).toHaveFocus();
  });
});
