import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { latestEmailToken } from "./mailpit";

const PASSWORD = "correct horse battery";

async function addRecord(page: Page, product: string, quantity: string) {
  await page.getByRole("button", { name: "Nuevo registro" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo registro" });
  await dialog.getByLabel("Producto *").fill(product);
  await dialog.getByLabel("Cantidad *").fill(quantity);
  await dialog.getByRole("button", { name: "Crear registro" }).click();
  await expect(dialog).toBeHidden();
}

function recordRows(page: Page) {
  return page.getByRole("table").getByRole("row").filter({ hasNot: page.getByRole("columnheader") });
}

test("a new user signs up, builds an inventory and works with its records", async ({ page }) => {
  const email = `e2e-${randomUUID()}@example.com`;

  // Sign up and confirm the address from the email link.
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Revisa tu correo" })).toBeVisible();

  await page.goto(`/verify-email?token=${await latestEmailToken(email)}`);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Confirmar y entrar" }).click();
  await expect(page).toHaveURL(/\/app$/);

  // Create a table from a template.
  await page.getByRole("main").getByRole("button", { name: "Nueva tabla" }).click();
  const createDialog = page.getByRole("dialog", { name: "Nueva tabla" });
  await createDialog.getByLabel("Nombre de la tabla").fill("Almacén E2E");
  await createDialog.getByRole("button", { name: "Crear tabla" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Almacén E2E" })).toBeVisible();

  // Add a column.
  await page.getByRole("link", { name: "Columnas" }).click();
  await page.getByRole("button", { name: "Añadir columna" }).click();
  const columnDialog = page.getByRole("dialog", { name: "Nueva columna" });
  await columnDialog.getByLabel("Nombre").fill("Proveedor");
  await columnDialog.getByRole("button", { name: "Añadir columna" }).click();
  await expect(page.getByText("Proveedor", { exact: true })).toBeVisible();

  // Create records and edit one in place.
  await page.getByRole("link", { name: "Registros" }).click();
  await addRecord(page, "Taladro", "5");
  await addRecord(page, "Martillo", "12");
  await expect(recordRows(page)).toHaveCount(2);

  await page.getByRole("button", { name: "Cantidad de Taladro: 5" }).click();
  const quantityField = page.getByRole("textbox", { name: "Cantidad de Taladro" });
  await quantityField.fill("8");
  await quantityField.press("Enter");
  await expect(page.getByRole("button", { name: "Cantidad de Taladro: 8" })).toBeVisible();

  // Filter by a range; the filter lives in the URL.
  await page.getByRole("button", { name: "Filtros" }).click();
  await page.getByRole("group", { name: "Cantidad" }).getByLabel("Desde").fill("10");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).toHaveURL(/filters=/);
  await expect(recordRows(page)).toHaveCount(1);
  await expect(recordRows(page)).toContainText("Martillo");

  await page.getByRole("button", { name: "Quitar el filtro de Cantidad" }).click();
  await expect(recordRows(page)).toHaveCount(2);

  // Sort by product name.
  await page.getByRole("button", { name: "Producto", exact: true }).click();
  await expect(page).toHaveURL(/sort=/);
  await expect(recordRows(page).first()).toContainText("Martillo");

  // Delete a record.
  await page.getByRole("button", { name: "Acciones del registro Taladro" }).click();
  await page.getByRole("menuitem", { name: "Borrar registro" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Borrar registro" }).click();
  await expect(recordRows(page)).toHaveCount(1);
  await expect(recordRows(page)).not.toContainText("Taladro");

  // Log out.
  await page.getByRole("button", { name: "Menú de la cuenta" }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
});
