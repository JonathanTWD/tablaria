/* eslint-disable react-refresh/only-export-components -- a build-time entry (scripts/prerender.mjs), never hot-reloaded. */
import { StrictMode } from "react";
import { prerender } from "react-dom/static";
import { StaticRouter } from "react-router";
import "./i18n";
import App from "./App.tsx";
import { Providers } from "./app/Providers.tsx";

export { PUBLIC_PATHS } from "./public-paths.ts";
export { llmsTxt } from "./llms-txt.ts";

/**
 * The HTML of a public page, rendered at build time (scripts/prerender.mjs)
 * so search engines and AI crawlers read its content without running
 * JavaScript (ADR-050). Lazy routes are waited for; nothing is fetched.
 */
export async function render(path: string): Promise<string> {
  const { prelude } = await prerender(
    <StrictMode>
      <StaticRouter location={path}>
        <Providers>
          <App />
        </Providers>
      </StaticRouter>
    </StrictMode>,
  );
  return new Response(prelude).text();
}
