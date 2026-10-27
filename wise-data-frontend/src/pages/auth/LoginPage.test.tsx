import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import LoginPage from "./LoginPage";

describe("LoginPage", () => {
  it("explains what is missing before calling the API", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi(() => ({}));
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText(/Introduce un email válido/)).toBeInTheDocument();
    expect(screen.getByText("Introduce tu contraseña.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports wrong credentials without trying to refresh the session", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi(() => 401);
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "wrong password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/email o la contraseña/i);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/auth/login");
  });
});
