import { columnDefinitionSchema, type TableColumn } from "@wisedata/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useCellFormatter } from "@/features/columns/format-value";
import { EditableCell } from "./EditableCell";

function column(definition: object): TableColumn {
  return {
    ...columnDefinitionSchema.parse({ name: "Precio", ...definition }),
    id: "price",
    position: 0,
    createdAt: "",
    updatedAt: "",
  };
}

const price = column({ type: "currency", options: { currency: "EUR" } });

function Cell(props: { column: TableColumn; value: number | boolean | null; onSave: () => void }) {
  return <EditableCell {...props} label="Precio de Taladro" format={useCellFormatter()} />;
}

describe("EditableCell", () => {
  it("saves a number typed with a decimal comma on Enter and returns focus", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Cell column={price} value={12.5} onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: /Precio de Taladro: 12,50/ }));
    const field = screen.getByRole("textbox", { name: "Precio de Taladro" });
    await user.clear(field);
    await user.type(field, "79,5{Enter}");

    expect(onSave).toHaveBeenCalledExactlyOnceWith(79.5);
    expect(screen.getByRole("button", { name: /Precio de Taladro/ })).toHaveFocus();
  });

  it("cancels with Escape without saving", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Cell column={price} value={12.5} onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: /Precio de Taladro/ }));
    await user.type(screen.getByRole("textbox"), "9{Escape}");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /12,50/ })).toHaveFocus();
  });

  it("keeps an invalid value open and explains why", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Cell column={price} value={12.5} onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: /Precio de Taladro/ }));
    const field = screen.getByRole("textbox");
    await user.clear(field);
    await user.type(field, "doce{Enter}");

    expect(onSave).not.toHaveBeenCalled();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(/no encaja/);
  });

  it("saves booleans as soon as they change", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Cell column={column({ type: "boolean" })} value={false} onSave={onSave} />);

    await user.click(screen.getByRole("checkbox", { name: "Precio de Taladro" }));

    expect(onSave).toHaveBeenCalledExactlyOnceWith(true);
  });
});
