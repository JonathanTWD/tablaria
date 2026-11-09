import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router";
import { buttonVariants } from "@/components/ui/button-variants";
import { docsFor } from "@/features/docs/content";
import { DocsNav } from "@/features/docs/DocsNav";
import { Prose } from "@/features/docs/prose";
import type { DocArticle, DocGroup } from "@/features/docs/types";
import { SiteFooter } from "@/features/landing/sections/SiteFooter";
import { SiteHeader } from "@/features/landing/sections/SiteHeader";
import { cn } from "@/lib/utils";

/** The router doesn't restore scroll: each article opens at its top, or at the section in the URL. */
function useScrollToSection(key: string, hash: string) {
  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) {
      target.scrollIntoView();
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [key, hash]);
}

function DocsIndex({ groups }: { groups: DocGroup[] }) {
  const { t } = useTranslation("docs");
  return (
    <>
      <title>{`${t("title")} | Tablaria`}</title>
      <h1 className="text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">{t("description")}</p>
      <div className="mt-12 space-y-12">
        {groups.map((group) => (
          <section key={group.title} aria-labelledby={`group-${group.articles[0]?.slug}`}>
            <h2 id={`group-${group.articles[0]?.slug}`} className="text-xl font-semibold tracking-tight">
              {group.title}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {group.articles.map((article) => (
                <li key={article.slug}>
                  <Link
                    to={`/ayuda/${article.slug}`}
                    className="flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="font-semibold">{article.title}</span>
                    <span className="mt-1.5 text-[0.95rem] leading-6 text-muted-foreground">{article.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function ArticleView({ article, group, previous, next }: {
  article: DocArticle;
  group: string;
  previous?: DocArticle;
  next?: DocArticle;
}) {
  const { t } = useTranslation("docs");
  return (
    <article>
      <title>{`${article.title} · ${t("title")} | Tablaria`}</title>
      <p className="text-sm font-semibold text-primary">{group}</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{article.title}</h1>
      <p className="mt-4 text-lg leading-8 text-muted-foreground">{article.description}</p>
      <Prose className="mt-8">{article.intro}</Prose>

      {article.sections.map((section) => (
        <section key={section.id} aria-labelledby={section.id} className="mt-12">
          <h2 id={section.id} className="text-2xl font-semibold tracking-tight">
            {section.title}
          </h2>
          <Prose className="mt-4">{section.body}</Prose>
        </section>
      ))}

      <nav aria-label={t("pagination")} className="mt-16 grid gap-3 border-t border-border pt-8 sm:grid-cols-2">
        {previous ? (
          <Link
            to={`/ayuda/${previous.slug}`}
            className="flex flex-col rounded-xl border border-border p-4 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ArrowLeft aria-hidden="true" className="size-3.5" />
              {t("previous")}
            </span>
            <span className="mt-1 font-semibold">{previous.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link
            to={`/ayuda/${next.slug}`}
            className="flex flex-col items-end rounded-xl border border-border p-4 text-right hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {t("next")}
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </span>
            <span className="mt-1 font-semibold">{next.title}</span>
          </Link>
        )}
      </nav>
    </article>
  );
}

function OnThisPage({ article }: { article: DocArticle }) {
  const { t } = useTranslation("docs");
  return (
    <nav aria-labelledby="on-this-page">
      <p id="on-this-page" className="text-sm font-semibold">
        {t("onThisPage")}
      </p>
      <ul className="mt-3 space-y-2 border-l border-border text-sm">
        {article.sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="-ml-px block border-l border-transparent pl-3 text-muted-foreground hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const DocsPage = () => {
  const { t, i18n } = useTranslation("docs");
  const { slug } = useParams();
  const { hash } = useLocation();
  const groups = docsFor(i18n.language);
  const articles = groups.flatMap(({ articles: list }) => list);
  const index = articles.findIndex((article) => article.slug === slug);
  const article = index >= 0 ? articles[index] : undefined;
  const group = article ? groups.find(({ articles: list }) => list.includes(article)) : undefined;
  // The mobile topic list closes after picking one.
  const [topicsOpen, setTopicsOpen] = useState(false);

  useScrollToSection(slug ?? "", hash);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto grid max-w-landing gap-10 px-4 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_13rem]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto py-10 pr-2 lg:block">
          <DocsNav groups={groups} />
        </aside>

        <main id="main" className="min-w-0 py-10 sm:py-14">
          <div className="mb-8 lg:hidden">
            <button
              type="button"
              aria-expanded={topicsOpen}
              aria-controls="docs-topics"
              onClick={() => setTopicsOpen((open) => !open)}
              className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between")}
            >
              {t("topics")}
              <ChevronDown
                aria-hidden="true"
                className={cn("transition-transform motion-reduce:transition-none", topicsOpen && "rotate-180")}
              />
            </button>
            <div id="docs-topics" hidden={!topicsOpen} className="mt-3 rounded-xl border border-border p-3">
              <DocsNav groups={groups} onNavigate={() => setTopicsOpen(false)} />
            </div>
          </div>

          <div className="mx-auto max-w-3xl">
            {slug === undefined ? (
              <DocsIndex groups={groups} />
            ) : article && group ? (
              <ArticleView
                article={article}
                group={group.title}
                previous={articles[index - 1]}
                next={articles[index + 1]}
              />
            ) : (
              <>
                <title>{`${t("notFoundTitle")} | Tablaria`}</title>
                <h1 className="text-3xl font-semibold tracking-tight">{t("notFoundTitle")}</h1>
                <p className="mt-4 text-lg text-muted-foreground">{t("notFoundDescription")}</p>
                <Link to="/ayuda" className={cn(buttonVariants(), "mt-8")}>
                  {t("backToIndex")}
                </Link>
              </>
            )}
          </div>
        </main>

        {article && (
          <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto py-14 xl:block">
            <OnThisPage article={article} />
          </aside>
        )}
      </div>
      <SiteFooter />
    </div>
  );
};

export default DocsPage;
