import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function FinalCta() {
  const { t } = useTranslation("landing");

  return (
    <section aria-labelledby="cta-title" className="px-4 pb-20 sm:px-6">
      <div className="mx-auto flex max-w-landing flex-col gap-8 rounded-3xl bg-brand-navy px-6 py-14 text-brand-navy-foreground sm:px-12 sm:py-20 md:flex-row md:items-end md:justify-between">
        <div>
          <h2
            id="cta-title"
            className="text-3xl font-semibold tracking-[-0.025em] sm:text-5xl 2xl:text-landing-title"
          >
            {t("cta.title")}
          </h2>
          <p className="mt-4 text-lg text-white/70">{t("cta.description")}</p>
        </div>
        <Link
          to="/register"
          className="inline-flex h-12 w-fit shrink-0 items-center rounded-lg bg-white px-6 font-semibold text-brand-navy transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {t("cta.action")}
        </Link>
      </div>
    </section>
  );
}
