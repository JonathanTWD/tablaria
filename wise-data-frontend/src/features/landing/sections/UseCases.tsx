import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { DemoInventoryTable } from "../DemoInventoryTable";
import { DEMO_CASES, useDemoDataset, type DemoCase } from "../use-demo-dataset";

export function UseCases() {
  const { t, i18n } = useTranslation("landing");
  const [current, setCurrent] = useState<DemoCase>("workshop");
  const dataset = useDemoDataset(current);

  return (
    <section
      id="casos"
      aria-labelledby="casos-title"
      className="scroll-mt-16 border-t border-border bg-secondary/50"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-2xl">
          <h2
            id="casos-title"
            className="text-3xl font-semibold tracking-[-0.025em] text-balance sm:text-5xl"
          >
            {t("useCases.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("useCases.description")}</p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
          <div
            role="group"
            aria-label={t("useCases.label")}
            className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible"
          >
            {DEMO_CASES.map((demoCase) => {
              const selected = demoCase === current;
              return (
                <button
                  key={demoCase}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCurrent(demoCase)}
                  className={cn(
                    "shrink-0 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:w-full",
                    selected
                      ? "border-primary bg-card shadow-sm"
                      : "border-transparent text-muted-foreground hover:bg-card hover:text-foreground",
                  )}
                >
                  <span className="block font-semibold">{t(`useCases.cases.${demoCase}.tab`)}</span>
                  <span className="mt-1 hidden text-sm leading-6 text-muted-foreground lg:block">
                    {t(`useCases.cases.${demoCase}.description`)}
                  </span>
                </button>
              );
            })}
          </div>

          <div>
            <p className="mb-4 text-muted-foreground lg:hidden">
              {t(`useCases.cases.${current}.description`)}
            </p>
            {/* A new key resets the table state when switching datasets. */}
            <DemoInventoryTable key={`${current}-${i18n.language}`} dataset={dataset} />
          </div>
        </div>
      </div>
    </section>
  );
}
