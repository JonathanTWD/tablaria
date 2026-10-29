import { columnDefinitionSchema, type TableColumn } from "@wisedata/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCellFormatter } from "@/features/columns/format-value";
import { ReadOnlyCell } from "@/features/records/EditableCell";

const BOSCH = "7c1f0e2a-1111-4aaa-8bbb-000000000001";

const supplier: TableColumn = {
  ...columnDefinitionSchema.parse({
    name: "Proveedor",
    type: "relation",
    options: { tableId: "7c1f0e2a-2222-4aaa-8bbb-000000000002" },
  }),
  id: "supplier",
  position: 0,
  createdAt: "",
  updatedAt: "",
};

function Cell({ linked }: { linked: Record<string, string> }) {
  return <ReadOnlyCell column={supplier} value={BOSCH} format={useCellFormatter()} linked={linked} />;
}

describe("relation cells", () => {
  it("show the linked record by its name", () => {
    render(<Cell linked={{ [BOSCH]: "Bosch" }} />);

    expect(screen.getByText("Bosch")).toBeVisible();
  });

  it("say there is a link, never what it is, without access to its table", () => {
    render(<Cell linked={{}} />);

    expect(screen.getByText("Registro de una tabla sin acceso")).toBeVisible();
    expect(screen.queryByText(BOSCH)).toBeNull();
  });
});
