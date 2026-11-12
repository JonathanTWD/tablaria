import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/** WCAG 2.2 at levels A and AA, what the project commits to (AGENTS.md). */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Reveal animations start transparent: axe would measure the contrast mid-fade.
test.use({ reducedMotion: "reduce" });

/** Fails with each violation, its rule and where it happens, readable in the CI log. */
async function expectAccessible(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const report = violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id} (${violation.impact}): ${node.target.join(" ")} — ${violation.help}`),
  );
  expect(report, `${name} has accessibility violations`).toEqual([]);
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.getByRole("heading", { level: 1 }).first().waitFor();
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`public pages, ${theme} theme`, () => {
    test.use({ colorScheme: theme });

    for (const path of ["/", "/ayuda", "/ayuda/calendario", "/privacidad", "/login", "/register"]) {
      test(path, async ({ page }) => {
        await page.goto(path);
        await settle(page);
        await expectAccessible(page, path);
      });
    }
  });
}

test("the app, in the demo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Probar la demo" }).first().click();
  await expect(page).toHaveURL(/\/app$/);
  await settle(page);
  await expectAccessible(page, "Inicio");

  const tables = (await (await page.request.get("/api/tables")).json()) as { id: string; name: string }[];
  const id = (name: string) => tables.find((table) => table.name === name)?.id ?? "";
  const products = `/app/tables/${id("Productos")}`;

  for (const path of [
    products,
    `${products}/columns`,
    `${products}/metrics`,
    `${products}/activity`,
    `/app/tables/${id("Pedidos")}/calendar`,
    "/app/settings",
  ]) {
    await page.goto(path);
    await settle(page);
    await expectAccessible(page, path);
  }

  // Dialogs too: a record's sheet, the scanner and the column form.
  await page.goto(products);
  await settle(page);
  await page.getByRole("button", { name: /^Producto de Taladro/ }).waitFor();
  await page.goto(`${products}?record=${await firstRecordId(page, id("Productos"))}`);
  await page.getByRole("dialog").waitFor();
  await expectAccessible(page, "record sheet");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Escanear un código" }).click();
  await page.getByRole("dialog", { name: "Escanear un código" }).waitFor();
  // The pointer still rests on the button, keeping its tooltip open under the dialog's backdrop.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  await expectAccessible(page, "scanner");
});

async function firstRecordId(page: Page, tableId: string): Promise<string> {
  const response = await page.request.get(`/api/tables/${tableId}/records`);
  const { data } = (await response.json()) as { data: { id: string }[] };
  return data[0]?.id ?? "";
}
