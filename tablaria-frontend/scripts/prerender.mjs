// Writes each public page's HTML into the build (ADR-050), so search engines and
// AI crawlers read its content and its own title, description and canonical link
// without running JavaScript. Runs after `vite build` and the SSR build of
// src/entry-prerender.tsx (see the "build" script).

// React picks its build when first loaded: the production one, like the app.
process.env.NODE_ENV ??= "production";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const { render, PUBLIC_PATHS, llmsTxt } = await import(
  pathToFileURL(join(root, "node_modules/.prerender/entry-prerender.js")).href
);

const template = await readFile(join(dist, "index.html"), "utf8");
if (template.includes("data-prerendered")) {
  // The home page replaced index.html on a previous run: it's no longer the template.
  throw new Error("dist/index.html is already prerendered: run the whole build (pnpm build) again");
}

// React writes a page's <title>, <meta> and <link> first; they belong in <head>.
const HEAD_TAGS = /^(?:<title>[^<]*<\/title>|<meta [^>]*\/>|<link [^>]*\/>)+/;
// The defaults in index.html that each page replaces with its own.
const DEFAULTS = [
  /<title>[^<]*<\/title>\s*/,
  /<meta\s+name="description"[^>]*\/>\s*/,
  /<link rel="canonical"[^>]*\/>\s*/,
  /<meta property="og:url"[^>]*\/>\s*/,
  /<meta property="og:title"[^>]*\/>\s*/,
  /<meta\s+property="og:description"[^>]*\/>\s*/,
  /<meta name="twitter:title"[^>]*\/>\s*/,
  /<meta\s+name="twitter:description"[^>]*\/>\s*/,
];

function page(path, rendered) {
  const head = rendered.match(HEAD_TAGS)?.[0];
  if (!head || !head.includes('rel="canonical"')) {
    throw new Error(`${path} renders no PageMeta: every public page needs its own title and canonical link`);
  }
  let html = template;
  for (const tag of DEFAULTS) {
    html = html.replace(tag, "");
  }
  return html
    .replace('<html lang="es">', `<html lang="es" data-prerendered="${path}">`)
    .replace("</head>", `${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${rendered.slice(head.length)}</div>`);
}

for (const path of PUBLIC_PATHS) {
  const html = page(path, await render(path));
  // "/ayuda/calendario" → ayuda/calendario/index.html, and ayuda/calendario.html for
  // hosts that map clean URLs to .html files. The home page replaces index.html.
  const files = path === "/" ? ["index.html"] : [join(path, "index.html"), `${path}.html`];
  for (const file of files) {
    await mkdir(dirname(join(dist, file)), { recursive: true });
    await writeFile(join(dist, file), html);
  }
}
await writeFile(join(dist, "llms.txt"), llmsTxt());
console.log(`Prerendered ${PUBLIC_PATHS.length} public pages, and llms.txt.`);
