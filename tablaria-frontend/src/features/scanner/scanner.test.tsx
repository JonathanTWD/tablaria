import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { interpretScan } from "./scan-result";
import { ScannerDialog } from "./ScannerDialog";

const ORIGIN = "https://tablaria.es";
const TABLE = "2fdd7402-4697-4887-8b6d-5a606dde638d";

describe("interpretScan", () => {
  it("opens a record from one of our QR labels", () => {
    expect(interpretScan(`${ORIGIN}/app/tables/${TABLE}?record=abc`, ORIGIN)).toEqual({
      kind: "record",
      tableId: TABLE,
      recordId: "abc",
      path: `/app/tables/${TABLE}?record=abc`,
    });
  });

  it("treats barcodes, other sites and other paths as codes to search", () => {
    expect(interpretScan(" 8436045100108 ", ORIGIN)).toEqual({ kind: "code", value: "8436045100108" });
    const foreign = `https://evil.example/app/tables/${TABLE}?record=abc`;
    expect(interpretScan(foreign, ORIGIN)).toEqual({ kind: "code", value: foreign });
    expect(interpretScan(`${ORIGIN}/app/settings?record=abc`, ORIGIN).kind).toBe("code");
    expect(interpretScan(`${ORIGIN}/app/tables/${TABLE}`, ORIGIN).kind).toBe("code");
  });
});

describe("ScannerDialog", () => {
  it("takes a typed code when there's no camera", async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ScannerDialog open onOpenChange={onOpenChange} description="Busca en la tabla" onScan={onScan} />,
    );

    // jsdom has no camera: the dialog says so and keeps the typed way in.
    expect(await screen.findByRole("status")).toHaveTextContent("Escribe el código");
    const submit = screen.getByRole("button", { name: "Buscar" });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("O escribe el código"), " 8436045100108 {Enter}");

    expect(onScan).toHaveBeenCalledWith("8436045100108");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
