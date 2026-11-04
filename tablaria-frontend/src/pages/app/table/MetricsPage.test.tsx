import {
  columnDefinitionSchema,
  type MetricGroups,
  type MetricsSummary,
  type StockAlerts,
  type TableColumn,
  type TableDetail,
  type Timeline,
} from "@tablaria/shared";
import { screen, within } from "@testing-library/react";
import { Outlet, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import MetricsPage from "./MetricsPage";

const TABLE = "4f5a6b7c-1111-4aaa-8bbb-000000000001";
const SALES = "4f5a6b7c-2222-4aaa-8bbb-000000000002";

function column(id: string, position: number, definition: object): TableColumn {
  return {
    ...columnDefinitionSchema.parse(definition),
    id,
    position,
    createdAt: "",
    updatedAt: "",
  };
}

const name = column("name", 0, { name: "Nombre", type: "text" });
const team = column("team", 1, {
  name: "Equipo",
  type: "relation",
  options: { tableId: "4f5a6b7c-3333-4aaa-8bbb-000000000003" },
});
const salary = column("salary", 2, {
  name: "Salario",
  type: "currency",
  options: { currency: "EUR" },
});
const stock = column("stock", 3, { name: "Stock", type: "number", options: { alertBelow: 2 } });

const table = {
  id: TABLE,
  name: "Empleados",
  recordCount: 3,
  columns: [name, team, salary, stock],
} as unknown as TableDetail;

const summary: MetricsSummary = {
  total: 3,
  columns: [
    { columnId: "salary", filled: 3, sum: 6300, avg: 2100, min: 1800, max: 2400 },
    { columnId: "stock", filled: 0, sum: null, avg: null, min: null, max: null },
  ],
};
const groups: MetricGroups = {
  total: 3,
  groups: [
    { value: SALES, count: 2, filled: 0, measure: null },
    { value: null, count: 1, filled: 0, measure: null },
  ],
  others: null,
  labels: { [SALES]: "Ventas" },
};
const timeline: Timeline = {
  buckets: [
    { start: "2026-01-01", count: 1, filled: 0, measure: null },
    { start: "2026-03-01", count: 2, filled: 0, measure: null },
  ],
};
const alerts: StockAlerts = {
  total: 1,
  items: [
    {
      tableId: TABLE,
      tableName: "Empleados",
      recordId: "r1",
      label: "Lucía",
      columnName: "Stock",
      value: 1,
      alertBelow: 2,
    },
  ],
};

describe("MetricsPage", () => {
  it("sums up the table, lists what runs low and charts it by group and over time", async () => {
    mockApi((url) => {
      if (url.pathname.endsWith("/summary")) return summary;
      if (url.pathname.endsWith("/groups")) return groups;
      if (url.pathname.endsWith("/timeline")) return timeline;
      return alerts;
    });
    // As the table layout renders it, with the table as outlet context.
    renderWithProviders(
      <Routes>
        <Route element={<Outlet context={table} />}>
          <Route path="*" element={<MetricsPage />} />
        </Route>
      </Routes>,
    );

    expect(await screen.findByText("Total de Salario")).toBeVisible();
    expect(screen.getByText(/6300,00\s€/)).toBeVisible();
    expect(screen.getByText(/Media 2100,00\s€ · Mín\. 1800,00\s€ · Máx\. 2400,00\s€/)).toBeVisible();
    expect(screen.getByText("Sin valores todavía")).toBeVisible();
    expect(screen.getByText("Bajo mínimo", { selector: "dt" })).toBeVisible();

    // Charts are drawn for the eye; their numbers are a table for screen readers.
    const byGroup = await screen.findByRole("table", { name: "Número de registros por Equipo" });
    expect(within(byGroup).getByRole("rowheader", { name: "Ventas" })).toBeInTheDocument();
    expect(within(byGroup).getByRole("rowheader", { name: "Sin valor" })).toBeInTheDocument();
    const overTime = await screen.findByRole("table", {
      name: "Número de registros por mes, según Fecha de creación",
    });
    // February had no records, and still shows.
    expect(within(overTime).getAllByRole("row")).toHaveLength(4);
  });
});
