/**
 * The pages anyone can open, for the sitemap that vite.config.ts writes at
 * build time. Plain data, since the config can't load the pages themselves;
 * a test checks it against the help and the legal pages.
 */
export const HELP_SLUGS = [
  "primeros-pasos",
  "columnas",
  "registros",
  "vistas-y-lote",
  "relaciones",
  "formulas",
  "importar-exportar",
  "stock",
  "metricas",
  "calendario",
  "etiquetas-qr",
  "compartir",
  "organizaciones",
  "tiempo-real",
  "asistente",
  "cuenta",
  "atajos",
];

export const LEGAL_PATHS = ["/privacidad", "/aviso-legal", "/cookies"];

export const PUBLIC_PATHS = ["/", "/ayuda", ...HELP_SLUGS.map((slug) => `/ayuda/${slug}`), ...LEGAL_PATHS];

/** The sitemap of the public pages, at the site's address. */
export function sitemapXml(siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, "");
  const urls = PUBLIC_PATHS.map((path) => `  <url><loc>${base}${path}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * Crawlers may read the public pages; the app and read-only links need an
 * account or a token. Read-only links are exactly /p (the token goes after
 * the #), so the rule ends in $: a bare "/p" would also block /privacidad.
 */
export function robotsTxt(siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `User-agent: *\nDisallow: /app\nDisallow: /p$\nDisallow: /invitations\n\nSitemap: ${base}/sitemap.xml\n`;
}
