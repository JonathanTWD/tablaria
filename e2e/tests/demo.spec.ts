import { expect, test } from "@playwright/test";

test("a visitor tries the demo without signing up", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Probar la demo" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hola, visitante" })).toBeVisible();
  await expect(page.getByText("Estás en una cuenta de demostración")).toBeVisible();

  // The example tables are there, with their records.
  await page.getByRole("link", { name: /Ferretería López/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Ferretería López" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Producto de Taladro percutor 750 W/ })).toBeVisible();

  // Leaving the demo ends the session.
  await page.getByRole("button", { name: "Salir de la demo" }).click();
  await expect(page).toHaveURL(/\/login/);
});
