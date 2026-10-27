import { defineConfig, devices } from "@playwright/test";

// Set it to test an instance that is already running (e.g. the Docker stack).
const EXTERNAL_URL = process.env.E2E_BASE_URL;
const BASE_URL = EXTERNAL_URL ?? "http://localhost:5173";
const isCI = Boolean(process.env.CI);

/**
 * Drives the real stack: Vite (proxying /api), the API, PostgreSQL and Mailpit.
 * Locally it reuses `pnpm dev` if it is already running; the database and
 * Mailpit come from `docker compose up -d`.
 */
export default defineConfig({
  testDir: "./tests",
  // One flow that registers its own unique user; parallel runs would only
  // compete for the per-IP rate limits.
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    locale: "es-ES",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: EXTERNAL_URL ? undefined : [
    {
      // CI runs the compiled API; locally `nest start` compiles it first.
      command: isCI
        ? "pnpm --filter wise-data-backend start:prod"
        : "pnpm --filter wise-data-backend start",
      url: "http://127.0.0.1:3000/api/health",
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter wise-data-frontend dev --port 5173 --strictPort",
      url: BASE_URL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
