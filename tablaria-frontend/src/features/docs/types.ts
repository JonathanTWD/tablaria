import type { ReactNode } from "react";

/** One heading of an article: its id is the URL fragment that links to it. */
export interface DocSection {
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * A help article. Content is written per language as JSX (see content/), so
 * the table of contents and the search come from data, not from the page.
 */
export interface DocArticle {
  slug: string;
  title: string;
  /** One sentence: shown in the index, the search results and the page title. */
  description: string;
  /** Words people may search with that the titles don't say. */
  keywords?: string[];
  intro: ReactNode;
  sections: DocSection[];
}

export interface DocGroup {
  title: string;
  articles: DocArticle[];
}
