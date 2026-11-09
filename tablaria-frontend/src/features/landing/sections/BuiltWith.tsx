import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const GROUPS = ["frontend", "backend", "quality", "production"] as const;

const AUTHOR_URL = "https://jonathan-morera-portfolio.vercel.app/";

export function BuiltWith() {
  const { t } = useTranslation("landing");

  return (
    <section aria-labelledby="tecnologia-title" className="border-t border-border">
      <div className="mx-auto grid max-w-landing gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div data-reveal>
          <h2
            id="tecnologia-title"
            className="text-3xl font-semibold tracking-[-0.025em] text-balance sm:text-5xl 2xl:text-landing-title"
          >
            {t("builtWith.title")}
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">{t("builtWith.description")}</p>
          <a
            href={AUTHOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-1.5 rounded-md font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t("builtWith.author")}
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
        </div>

        <dl className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <div key={group} data-reveal className="border-t border-foreground/15 pt-5">
              <dt className="text-sm font-semibold text-primary">{t(`builtWith.groups.${group}.title`)}</dt>
              {t(`builtWith.groups.${group}.items`, { returnObjects: true }).map((item) => (
                <dd key={item} className="mt-2 text-lg">
                  {item}
                </dd>
              ))}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
