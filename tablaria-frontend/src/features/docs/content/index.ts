import type { DocGroup } from "../types";
import { DOCS_ES } from "./es";

// Adding a language means adding its articles here, with the same slugs.
const DOCS: Record<string, DocGroup[]> = { es: DOCS_ES };

export function docsFor(language: string): DocGroup[] {
  return DOCS[language.split("-")[0]] ?? DOCS_ES;
}
