import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { Prose } from "@/features/docs/prose";
import { useScrollToSection } from "@/features/docs/use-scroll-to-section";
import { SiteFooter } from "@/features/landing/sections/SiteFooter";
import { SiteHeader } from "@/features/landing/sections/SiteHeader";
import { PageMeta } from "@/features/seo/PageMeta";
import { LEGAL_PAGES, type LegalPageId } from "@/features/legal/content";
import { LEGAL_UPDATED } from "@/features/legal/owner";

const LegalPage = ({ page }: { page: LegalPageId }) => {
  const { t, i18n } = useTranslation("legal");
  const { article } = LEGAL_PAGES[page];
  const updated = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(LEGAL_UPDATED),
  );
  const others = (Object.keys(LEGAL_PAGES) as LegalPageId[]).filter((id) => id !== page);

  const { hash } = useLocation();
  useScrollToSection(page, hash);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <PageMeta title={`${article.title} | Tablaria`} description={article.description} path={LEGAL_PAGES[page].path} />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{article.title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">{t("updated", { date: updated })}</p>
        <Prose className="mt-8">{article.intro}</Prose>

        <nav aria-labelledby="legal-contents" className="mt-8 rounded-xl border border-border p-5">
          <p id="legal-contents" className="text-sm font-semibold">
            {t("contents")}
          </p>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-[0.95rem] sm:grid-cols-2">
            {article.sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {index + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {article.sections.map((section, index) => (
          <section key={section.id} aria-labelledby={section.id} className="mt-12">
            <h2 id={section.id} className="text-2xl font-semibold tracking-tight">
              {index + 1}. {section.title}
            </h2>
            <Prose className="mt-4">{section.body}</Prose>
          </section>
        ))}

        <nav aria-label={t("others")} className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-8 text-sm">
          {others.map((id) => (
            <Link
              key={id}
              to={LEGAL_PAGES[id].path}
              className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {LEGAL_PAGES[id].article.title}
            </Link>
          ))}
        </nav>
      </main>
      <SiteFooter />
    </div>
  );
};

export default LegalPage;
