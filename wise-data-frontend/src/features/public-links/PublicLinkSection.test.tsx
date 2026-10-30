import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import { PublicLinkSection } from "./PublicLinkSection";

const TOKEN = "a".repeat(43);

function user(demo: boolean) {
  return {
    id: "u1",
    email: "ana@example.com",
    demoExpiresAt: demo ? "2026-11-01T00:00:00.000Z" : null,
  };
}

describe("PublicLinkSection", () => {
  it("creates a link and shows it once, ready to copy", async () => {
    const browser = userEvent.setup();
    let enabled = false;
    mockApi((url, init) => {
      if (url.pathname.endsWith("/auth/me")) {
        return user(false);
      }
      if (init.method === "PUT") {
        enabled = true;
        return { token: TOKEN, createdAt: "2026-10-31T10:00:00.000Z" };
      }
      return { enabled, createdAt: enabled ? "2026-10-31T10:00:00.000Z" : null };
    });
    renderWithProviders(<PublicLinkSection tableId="table-1" />);

    await browser.click(await screen.findByRole("button", { name: "Crear enlace" }));
    expect(await screen.findByLabelText("Enlace")).toHaveValue(`${window.location.origin}/p#${TOKEN}`);
    expect(screen.getByText(/no se puede volver a mostrar/)).toBeVisible();
    expect(await screen.findByRole("button", { name: "Desactivar" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Crear un enlace nuevo" })).toBeVisible();
  });

  it("says a link is active without showing it again", async () => {
    mockApi((url) =>
      url.pathname.endsWith("/auth/me")
        ? user(false)
        : { enabled: true, createdAt: new Date().toISOString() },
    );
    renderWithProviders(<PublicLinkSection tableId="table-1" />);

    expect(await screen.findByText(/Hay un enlace activo/)).toBeVisible();
    expect(screen.queryByLabelText("Enlace")).not.toBeInTheDocument();
    expect(screen.getByText(/el anterior dejará de funcionar/)).toBeVisible();
  });

  it("explains that the demo can't publish links", async () => {
    mockApi(() => user(true));
    renderWithProviders(<PublicLinkSection tableId="table-1" />);

    expect(
      await screen.findByText("En la demo no se pueden crear enlaces públicos."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Crear enlace" })).not.toBeInTheDocument();
  });
});
