import type { DocArticle } from "./types";

export interface DocSearchResult {
  article: DocArticle;
  /** The section whose title matched, to link straight to it. */
  sectionId?: string;
  sectionTitle?: string;
}

/** Lowercase and without accents, so "formula" finds "Fórmulas". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Articles whose title, sections, description or keywords contain every word
 * of the query, best matches first: title, then a section, then the rest.
 */
export function searchDocs(articles: DocArticle[], query: string): DocSearchResult[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const matches = (text: string) => {
    const normalized = normalize(text);
    return words.every((word) => normalized.includes(word));
  };

  const scored = articles.flatMap((article) => {
    if (matches(article.title)) {
      return [{ score: 0, result: { article } }];
    }
    const section = article.sections.find(({ title }) => matches(title));
    if (section) {
      return [{ score: 1, result: { article, sectionId: section.id, sectionTitle: section.title } }];
    }
    const rest = [article.description, ...(article.keywords ?? []), ...article.sections.map(({ title }) => title)];
    return matches(rest.join(" ")) ? [{ score: 2, result: { article } }] : [];
  });

  // Stable: equal scores keep the order of the index.
  return scored.sort((a, b) => a.score - b.score).map(({ result }) => result);
}
