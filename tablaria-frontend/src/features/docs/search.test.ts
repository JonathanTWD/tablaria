import { describe, expect, it } from "vitest";
import { DOCS_ES } from "./content/es";
import { normalize, searchDocs } from "./search";
import type { DocArticle } from "./types";

const article = (slug: string, title: string, sections: string[], extra: Partial<DocArticle> = {}): DocArticle => ({
  slug,
  title,
  description: "",
  intro: null,
  sections: sections.map((section, index) => ({ id: `${slug}-${index}`, title: section, body: null })),
  ...extra,
});

const ARTICLES = [
  article("formulas", "Fórmulas", ["Funciones", "Ejemplos"]),
  article("stock", "Stock y avisos", ["Anotar movimientos", "Avisos de bajo mínimo"]),
  article("importar", "Importar y exportar", ["Filas repetidas"], { keywords: ["excel", "xlsx"] }),
];

describe("searchDocs", () => {
  it("ignores accents and case", () => {
    expect(normalize("  FÓRMULAS ")).toBe("formulas");
    expect(searchDocs(ARTICLES, "formula").map(({ article: { slug } }) => slug)).toEqual(["formulas"]);
    expect(searchDocs(ARTICLES, "minimo")[0]?.sectionTitle).toBe("Avisos de bajo mínimo");
  });

  it("needs every word, in any order", () => {
    expect(searchDocs(ARTICLES, "avisos stock")).toHaveLength(1);
    expect(searchDocs(ARTICLES, "stock fórmulas")).toEqual([]);
  });

  it("puts title matches before section matches, and those before keywords", () => {
    const results = searchDocs(
      [article("a", "Excel de ida y vuelta", []), ...ARTICLES, article("b", "Otra", ["Excel paso a paso"])],
      "excel",
    );
    expect(results.map(({ article: { slug } }) => slug)).toEqual(["a", "b", "importar"]);
    expect(results[1]?.sectionId).toBe("b-0");
  });

  it("finds nothing for an empty query", () => {
    expect(searchDocs(ARTICLES, "   ")).toEqual([]);
  });
});

describe("the Spanish help", () => {
  const all = DOCS_ES.flatMap(({ articles }) => articles);

  it("has unique slugs and section ids, so every link has one target", () => {
    expect(new Set(all.map(({ slug }) => slug)).size).toBe(all.length);
    for (const { sections } of all) {
      expect(new Set(sections.map(({ id }) => id)).size).toBe(sections.length);
    }
  });
});
