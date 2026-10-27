import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { THEME_STORAGE_KEY } from "./theme-context";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("applies the chosen theme and remembers it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "Tema" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /Oscuro/ }));

    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("forgets the stored choice when going back to the system theme", async () => {
    const user = userEvent.setup();
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    renderWithProviders(<ThemeToggle />);
    expect(document.documentElement).toHaveClass("dark");

    await user.click(screen.getByRole("button", { name: "Tema" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /Sistema/ }));

    // The test environment reports a light system theme.
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});
