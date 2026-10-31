import { columnDefinitionSchema, type TableColumn } from "@tablaria/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useCellFormatter } from "@/features/columns/format-value";
import { ReadOnlyCell } from "@/features/records/EditableCell";
import { mockApi, renderWithProviders } from "@/test/render";
import { RelationPicker } from "./RelationPicker";

const PEOPLE = "5d0c1a2b-1111-4aaa-8bbb-000000000001";
const NAME = "5d0c1a2b-2222-4aaa-8bbb-000000000002";
const LUCIA = "5d0c1a2b-3333-4aaa-8bbb-000000000003";
const MARCO = "5d0c1a2b-4444-4aaa-8bbb-000000000004";

function teamColumn(required = false): TableColumn {
  return {
    ...columnDefinitionSchema.parse({
      name: "Equipo",
      type: "relation",
      required,
      options: { tableId: PEOPLE, multiple: true },
    }),
    id: "team",
    position: 0,
    createdAt: "",
    updatedAt: "",
  };
}

const names: Record<string, string> = { [LUCIA]: "Lucía", [MARCO]: "Marco" };

/** The linked table, Empleados, and its records. */
function mockPeople() {
  mockApi((url) =>
    url.pathname.endsWith("/records")
      ? {
          data: [LUCIA, MARCO].map((id) => ({
            id,
            data: { [NAME]: names[id] },
            createdAt: "",
            updatedAt: "",
          })),
          meta: { page: 1, pageSize: 10, total: 2, pageCount: 1 },
          linked: {},
          groups: [],
          labelledRelations: [],
        }
      : {
          id: PEOPLE,
          name: "Empleados",
          columns: [{ id: NAME, name: "Nombre", type: "text", position: 0 }],
        },
  );
}

function Picker({ required, onChange }: { required?: boolean; onChange: (value: unknown) => void }) {
  const [value, setValue] = useState<string[] | null>([LUCIA]);
  return (
    <RelationPicker
      column={teamColumn(required)}
      value={value}
      linked={names}
      label="Equipo de Web"
      onChange={(next) => {
        setValue(next as string[] | null);
        onChange(next);
      }}
    />
  );
}

describe("multiple relations", () => {
  it("add and remove linked records one by one, keeping the list open", async () => {
    const user = userEvent.setup();
    mockPeople();
    const onChange = vi.fn();
    renderWithProviders(<Picker onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Equipo de Web: Lucía" }));
    await user.click(await screen.findByRole("button", { name: "Marco", pressed: false }));
    expect(onChange).toHaveBeenLastCalledWith([LUCIA, MARCO]);
    expect(screen.getByRole("button", { name: "Marco", pressed: true })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Quitar Lucía" }));
    expect(onChange).toHaveBeenLastCalledWith([MARCO]);
    // Its button is gone: the focus stays in the popup.
    expect(screen.getByRole("textbox", { name: "Buscar en Empleados" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Quitar todos los enlaces" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("keep the last link of a required relation", async () => {
    const user = userEvent.setup();
    mockPeople();
    renderWithProviders(<Picker required onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Equipo de Web: Lucía" }));
    expect(await screen.findByRole("button", { name: "Lucía", pressed: true })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Quitar Lucía" })).toBeNull();
  });

  it("show every linked record when read only", () => {
    function Cell() {
      return (
        <ReadOnlyCell
          column={teamColumn()}
          value={[MARCO, LUCIA]}
          format={useCellFormatter()}
          linked={names}
        />
      );
    }
    renderWithProviders(<Cell />);

    expect(screen.getByText("Marco, Lucía")).toBeVisible();
  });
});
