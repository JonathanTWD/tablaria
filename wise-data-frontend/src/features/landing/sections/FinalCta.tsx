import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function FinalCta() {
  const { t } = useTranslation("landing");

  return (
    <section aria-labelledby="cta-title" className="px-4 pb-20 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 rounded-3xl bg-brand-navy px-6 py-14 text-brand-navy-foreground sm:px-12 sm:py-20 md:flex-row md:items-end md:justify-between">
        <div>
          <h2
            id="cta-title"
            className="text-3xl font-semibold tracking-[-0.025em] sm:text-5xl"
          >
            {t("cta.title")}
          </h2>
          <p className="mt-4 text-lg text-white/70">{t("cta.description")}</p>
        </div>
        <Link
          to="/register"
          className="inline-flex h-12 w-fit shrink-0 items-center rounded-lg bg-white px-6 font-semibold text-[#15163a] transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {t("cta.action")}
        </Link>
      </div>
    </section>
  );
}

export function SiteFooter() {
  const { t } = useTranslation("landing");
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <span>{t("footer", { year: new Date().getFullYear() })}</span>
        <Link to="/login" className="rounded-md hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          {t("nav.login")}
        </Link>
      </div>
    </footer>
  );
}
