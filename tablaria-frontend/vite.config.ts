/// <reference types="vitest/config" />
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Not prefixed with VITE_, so they are only used here and never shipped to the client.
  const { API_PROXY_TARGET = "http://localhost:3000", SITE_URL = "http://localhost:5173" } =
    loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      {
        // Canonical URL and link previews need the public address, set per deployment.
        name: "site-url",
        transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", SITE_URL.replace(/\/$/, "")),
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
    },
    // Same-origin API so httpOnly auth cookies behave as in production. `preview`
    // serves the production build the same way (the browser tests use it in CI).
    server: { proxy: apiProxy(API_PROXY_TARGET) },
    preview: { proxy: apiProxy(API_PROXY_TARGET) },
  };
});

function apiProxy(target: string) {
  return {
    "/api": {
      target,
      changeOrigin: true,
      xfwd: true,
      // Realtime updates use a WebSocket under /api.
      ws: true,
    },
  };
}
