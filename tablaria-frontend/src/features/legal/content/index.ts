import type { DocArticle } from "@/features/docs/types";
import { avisoLegal } from "./es/aviso-legal";
import { cookies } from "./es/cookies";
import { privacidad } from "./es/privacidad";

export type LegalPageId = "privacy" | "legal" | "cookies";

/** Each legal page with its path; one language for now, like the help (ADR-045). */
export const LEGAL_PAGES: Record<LegalPageId, { path: string; article: DocArticle }> = {
  privacy: { path: "/privacidad", article: privacidad },
  legal: { path: "/aviso-legal", article: avisoLegal },
  cookies: { path: "/cookies", article: cookies },
};
