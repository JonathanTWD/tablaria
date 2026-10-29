import type { AuthUser, OrganizationDetail, TableRole } from "@wisedata/shared";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import { MembersSection } from "./MembersSection";

const me: AuthUser = {
  id: "0b1c2d3e-0000-4aaa-8bbb-000000000001",
  email: "ana@example.com",
  emailVerifiedAt: "2026-01-01T00:00:00.000Z",
  demoExpiresAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function member(userId: string, email: string, role: TableRole) {
  return { userId, email, role, createdAt: "2026-01-01T00:00:00.000Z" };
}

function organization(role: TableRole): OrganizationDetail {
  return {
    id: "5b6c7d8e-0000-4aaa-8bbb-000000000001",
    name: "Ferretería",
    personal: false,
    role,
    memberCount: 3,
    tableCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    members: [
      member(me.id, me.email, role),
      member("0b1c2d3e-0000-4aaa-8bbb-000000000002", "jefa@example.com", "OWNER"),
      member("0b1c2d3e-0000-4aaa-8bbb-000000000003", "luis@example.com", "EDITOR"),
    ],
    invitations: [],
  };
}

describe("MembersSection", () => {
  it("lets admins manage members, but not owners or themselves", async () => {
    mockApi((url) => (url.pathname === "/api/auth/me" ? me : 404));
    renderWithProviders(<MembersSection organization={organization("ADMIN")} />);

    // In the app the session is always loaded here (RequireAuth); in the test it loads first.
    expect(await screen.findByText("(Tú)")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Rol de luis@example.com" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Quitar a luis@example.com" })).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Rol de jefa@example.com" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Quitar a jefa@example.com" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Quitar a ana@example.com" })).toBeNull();
  });

  it("shows members read-only to those who don't manage", async () => {
    mockApi((url) => (url.pathname === "/api/auth/me" ? me : 404));
    renderWithProviders(<MembersSection organization={organization("EDITOR")} />);

    expect(await screen.findByText("(Tú)")).toBeVisible();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
