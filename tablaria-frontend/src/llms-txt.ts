import { DOCS_ES } from "@/features/docs/content/es";
import { LEGAL_PAGES } from "@/features/legal/content";
import { absoluteUrl } from "@/features/seo/structured-data";

/**
 * /llms.txt (llmstxt.org): what Tablaria is and where each guide lives, for
 * AI assistants that answer questions about it (ADR-050). Written at build
 * time from the same guides the help center shows, so it never drifts.
 */
export function llmsTxt(): string {
  const link = (title: string, path: string, description: string) =>
    `- [${title}](${absoluteUrl(path)}): ${description}`;
  return [
    "# Tablaria",
    "",
    "> Aplicación web gratuita de gestión de inventario en tablas personalizables: cada negocio crea las columnas que necesita, enlaza tablas entre sí y trabaja en equipo en tiempo real.",
    "",
    "Tablaria está en español. Incluye columnas de texto, número, fecha, sí/no, lista de opciones y precio; relaciones entre tablas con consultas, resúmenes y fórmulas; movimientos de stock con avisos de bajo mínimo; calendario y avisos de fechas próximas; etiquetas QR y adjuntos; importación y exportación de Excel y CSV; vistas guardadas y edición en lote; organizaciones con roles; y un asistente de IA que responde preguntas sobre los datos sin modificarlos. Hay una demo sin registro con datos de ejemplo.",
    "",
    "## Ayuda",
    "",
    ...DOCS_ES.flatMap(({ articles }) =>
      articles.map(({ slug, title, description }) => link(title, `/ayuda/${slug}`, description)),
    ),
    "",
    "## Legal",
    "",
    ...Object.values(LEGAL_PAGES).map(({ path, article }) => link(article.title, path, article.description)),
    "",
    "## Optional",
    "",
    link("Inicio", "/", "Qué es Tablaria, sus funciones, preguntas frecuentes y acceso a la demo."),
    "",
  ].join("\n");
}
