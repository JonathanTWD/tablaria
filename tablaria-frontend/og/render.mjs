// Renders the share preview and the touch icon into public/.
// Run from the repo root after `pnpm install` (it reuses Playwright's Chromium):
//   node tablaria-frontend/og/render.mjs
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, "../../e2e/package.json"));
const { chromium } = require("@playwright/test");

const browser = await chromium.launch();
try {
  const preview = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await preview.goto(pathToFileURL(resolve(here, "og-image.html")).href);
  await preview.evaluate(() => document.fonts.ready);
  await preview.screenshot({ path: resolve(here, "../public/og-image.png") });

  // iOS home-screen icon: the favicon on a full square (iOS rounds the corners itself).
  const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await icon.setContent(
    `<body style="margin:0;background:#3b2bea">
       <img src="${pathToFileURL(resolve(here, "../public/favicon.svg")).href}"
            style="width:180px;height:180px;display:block" />
     </body>`,
  );
  await icon.screenshot({ path: resolve(here, "../public/apple-touch-icon.png") });
} finally {
  await browser.close();
}
