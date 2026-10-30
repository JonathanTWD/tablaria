import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import LoginPage from "./LoginPage";

/** Paths the page requested, in order. The session probe (/auth/me) is part of it. */
function requestedPaths(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

describe("LoginPage", () => {
  it("explains what is missing before calling the API", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi(() => 401);
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText(/Introduce un email válido/)).toBeInTheDocument();
    expect(screen.getByText("Introduce tu contraseña.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(requestedPaths(fetchMock)).not.toContain("/api/auth/login");
  });

  it("reports wrong credentials without trying to refresh the session", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi(() => 401);
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "wrong password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/email o la contraseña/i);
    const paths = requestedPaths(fetchMock);
    const login = paths.indexOf("/api/auth/login");
    expect(paths.filter((path) => path === "/api/auth/login")).toHaveLength(1);
    // A 401 from login means wrong credentials, never an expired session.
    expect(paths.slice(login + 1)).not.toContain("/api/auth/refresh");
  });

  it("tells invited people without an account to sign up with the invited email", async () => {
    mockApi(() => 401);
    const redirect = encodeURIComponent("/invitations?token=abc");
    renderWithProviders(<LoginPage />, { route: `/login?redirect=${redirect}` });

    const signUp = await screen.findByRole("link", { name: "Crear cuenta con ese email" });
    // The invitation stays the destination through sign-up.
    expect(signUp).toHaveAttribute("href", `/register?redirect=${redirect}`);
  });
});
