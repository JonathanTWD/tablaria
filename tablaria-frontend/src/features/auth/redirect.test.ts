import { describe, expect, it } from "vitest";
import { isInvitationPath, rememberAfterSignup, safeRedirect, takeAfterSignup } from "./redirect";

describe("redirect", () => {
  it("only follows internal paths", () => {
    expect(safeRedirect("/app/settings")).toBe("/app/settings");
    expect(safeRedirect("https://evil.example")).toBe("/app");
    expect(safeRedirect("//evil.example")).toBe("/app");
    expect(safeRedirect(null)).toBe("/app");
  });

  it("recognizes invitation links", () => {
    expect(isInvitationPath("/invitations?token=abc")).toBe(true);
    expect(isInvitationPath("/app")).toBe(false);
    expect(isInvitationPath(null)).toBe(false);
  });

  it("remembers the invitation until the new account is confirmed, once", () => {
    rememberAfterSignup("/invitations?token=abc");

    expect(takeAfterSignup()).toBe("/invitations?token=abc");
    expect(takeAfterSignup()).toBe("/app");
  });

  it("never turns a remembered value into an external redirect", () => {
    localStorage.setItem("tablaria:after-signup", "//evil.example");

    expect(takeAfterSignup()).toBe("/app");
  });
});
