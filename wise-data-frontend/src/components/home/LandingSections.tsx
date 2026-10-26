import { Columns3, PencilLine, Search, Table2, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { InventoryPreview } from "@/components/InventoryPreview";

const FEATURES: { key: "tables" | "types" | "search" | "editing"; icon: LucideIcon }[] = [
  { key: "tables", icon: Table2 },
  { key: "types", icon: Columns3 },
  { key: "search", icon: Search },
  { key: "editing", icon: PencilLine },
];

export function FeaturesSection() {
  const { t } = useTranslation("landing");
  return (
    <section
      id="funciones"
      aria-labelledby="funciones-title"
      className="scroll-mt-6 border-t border-white/10 px-6 py-24 lg:px-[8vw]"
    >
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center">
        <div>
          <h2
            id="funciones-title"
            className="max-w-lg text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl"
          >
            {t("features.title")}
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-white/70">
            {t("features.description")}
          </p>
          <dl className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {FEATURES.map(({ key, icon: Icon }) => (
              <div key={key}>
                <dt className="flex items-center gap-2 font-semibold text-white">
                  <Icon aria-hidden="true" className="size-4 text-[#b9b2ff]" />
                  {t(`features.items.${key}.title`)}
                </dt>
                <dd className="mt-2 text-sm leading-6 text-white/65">
                  {t(`features.items.${key}.description`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <InventoryPreview />
      </div>
    </section>
  );
}

export function AboutSection() {
  const { t } = useTranslation("landing");
  return (
    <section
      id="sobre"
      aria-labelledby="sobre-title"
      className="scroll-mt-6 border-t border-white/10 px-6 py-24 lg:px-[8vw]"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <h2
            id="sobre-title"
            className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl"
          >
            {t("about.title")}
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/70">{t("about.body")}</p>
        </div>
      </div>
    </section>
  );
}

export function CallToAction() {
  const { t } = useTranslation("landing");
  return (
    <section
      aria-labelledby="cta-title"
      className="border-t border-white/10 px-6 py-24 lg:px-[8vw]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="cta-title"
            className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl"
          >
            {t("cta.title")}
          </h2>
          <p className="mt-3 text-white/70">{t("cta.description")}</p>
        </div>
        <Link
          to="/register"
          className="w-fit shrink-0 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {t("cta.action")}
        </Link>
      </div>
    </section>
  );
}

export function Footer() {
  const { t } = useTranslation("landing");
  return (
    <footer className="border-t border-white/10 px-6 py-8 text-sm text-white/55 lg:px-[8vw]">
      <div className="mx-auto max-w-7xl">
        {t("footer", { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
