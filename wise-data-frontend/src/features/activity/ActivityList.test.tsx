import type { ActivityEvent, ActivityPage, TableDetail } from "@wisedata/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import { ActivityList } from "./ActivityList";

const table = { id: "2d0f8e4a-3c4d-4e5f-8a0b-2c3d4e5f6071" } as TableDetail;

function event(fields: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: crypto.randomUUID(),
    action: "record.created",
    by: "ana",
    mine: false,
    label: "Taladro",
    recordId: null,
    details: {},
    createdAt: "2026-10-30T10:35:00.000Z",
    ...fields,
  };
}

function page(data: ActivityEvent[], current: number, pageCount: number): ActivityPage {
  return { data, meta: { page: current, pageSize: 30, total: 31, pageCount } };
}

describe("ActivityList", () => {
  it("tells who changed what, and loads older events on demand", async () => {
    const user = userEvent.setup();
    mockApi((url) =>
      url.searchParams.get("page") === "1"
        ? page(
            [
              event({ action: "record.updated", mine: true, details: { columns: ["Stock", "Precio"] } }),
              event({ action: "stock.moved", details: { kind: "out", delta: -2, column: "Stock" } }),
              event({ action: "records.imported", label: null, by: null, details: { created: 3, updated: 1 } }),
              event({ action: "column.updated", label: "Unidades", details: { renamedFrom: "Stock" } }),
            ],
            1,
            2,
          )
        : page([event({ action: "column.deleted", label: "Notas" })], 2, 2),
    );
    renderWithProviders(<ActivityList table={table} />);

    expect(await screen.findByText("Cambios en «Taladro»: Stock y Precio")).toBeVisible();
    expect(screen.getByText(/^Tú ·/)).toBeVisible();
    expect(screen.getByText("Salida de 2 en Stock de «Taladro»")).toBeVisible();
    expect(
      screen.getByText("Importación de un archivo: 3 registros nuevos · 1 actualizado"),
    ).toBeVisible();
    expect(screen.getByText(/^Una cuenta de demostración o borrada ·/)).toBeVisible();
    expect(screen.getByText("Columna «Stock» renombrada a «Unidades»")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Ver más" }));
    expect(await screen.findByText("Columna «Notas» borrada")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Ver más" })).not.toBeInTheDocument();
  });
});
