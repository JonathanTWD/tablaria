import { expect, test } from "@playwright/test";

test("a visitor tries the demo without signing up", async ({ page }) => {
  await page.goto("/");
  // The hero's button; the closing section has another one.
  await page.getByRole("button", { name: "Probar la demo" }).first().click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hola, visitante" })).toBeVisible();
  await expect(page.getByText("Estás en una cuenta de demostración")).toBeVisible();

  // The example tables are there, with their records and the columns worked out from them.
  await page.getByRole("link", { name: /^Productos/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Productos" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Producto de Taladro percutor 750 W/ })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Margen" })).toBeVisible();

  // Leaving the demo ends the session.
  await page.getByRole("button", { name: "Salir de la demo" }).click();
  await expect(page).toHaveURL(/\/login/);
});
