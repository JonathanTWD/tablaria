import { Search } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchDocs } from "./search";
import type { DocGroup } from "./types";

const LINK_CLASS =
  "block rounded-md px-2.5 py-1.5 text-[0.95rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring";

/** The list of topics, or the matches of what is typed in its search box. */
export function DocsNav({ groups, onNavigate }: { groups: DocGroup[]; onNavigate?: () => void }) {
  const { t } = useTranslation("docs");
  const ids = useId();
  const [query, setQuery] = useState("");
  const results = searchDocs(
    groups.flatMap(({ articles }) => articles),
    query,
  );
  const searching = query.trim().length > 0;

  return (
    <nav aria-label={t("nav")}>
      <div className="relative">
        <label htmlFor={`${ids}-search`} className="sr-only">
          {t("search")}
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={`${ids}-search`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="pl-8"
          aria-describedby={searching ? `${ids}-results` : undefined}
        />
      </div>

      {searching ? (
        <div className="mt-4">
          <p id={`${ids}-results`} role="status" className="px-2.5 text-sm text-muted-foreground">
            {results.length > 0 ? t("results", { count: results.length }) : t("noResults", { query: query.trim() })}
          </p>
          <ul className="mt-2 space-y-0.5">
            {results.map(({ article, sectionId, sectionTitle }) => (
              <li key={article.slug}>
                <Link
                  to={`/ayuda/${article.slug}${sectionId ? `#${sectionId}` : ""}`}
                  onClick={onNavigate}
                  className={LINK_CLASS}
                >
                  <span className="block font-medium text-foreground">{article.title}</span>
                  {sectionTitle && <span className="block text-sm">{sectionTitle}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-2.5 text-xs font-semibold tracking-wide text-foreground uppercase">{group.title}</p>
              <ul className="mt-2 space-y-0.5">
                {group.articles.map((article) => (
                  <li key={article.slug}>
                    <NavLink
                      to={`/ayuda/${article.slug}`}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(LINK_CLASS, isActive && "bg-accent font-medium text-accent-foreground hover:bg-accent")
                      }
                    >
                      {article.title}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
