import {
  Calendar,
  Euro,
  Hash,
  ListChecks,
  Search,
  ToggleLeft,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const COLUMN_TYPES: { key: "text" | "number" | "date" | "boolean" | "select" | "currency"; icon: LucideIcon }[] = [
  { key: "text", icon: Type },
  { key: "number", icon: Hash },
  { key: "date", icon: Calendar },
  { key: "boolean", icon: ToggleLeft },
  { key: "select", icon: ListChecks },
  { key: "currency", icon: Euro },
];

/** Small static fragment of the real UI; decorative, the step text carries the meaning. */
function MiniUi({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "mt-6 rounded-xl border border-border bg-card p-3 text-sm shadow-[0_12px_32px_-20px_rgb(21_22_58/0.35)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function HowItWorks() {
  const { t } = useTranslation("landing");

  const steps = [
    {
      key: "create",
      ui: (
        <MiniUi>
          <div className="flex h-9 items-center rounded-lg border border-ring px-3 ring-3 ring-ring/20">
            {t("howItWorks.steps.create.example")}
            <span className="ml-0.5 h-4 w-px bg-foreground motion-safe:animate-pulse" />
          </div>
        </MiniUi>
      ),
    },
    {
      key: "columns",
      ui: (
        <MiniUi className="grid grid-cols-2 gap-1.5">
          {COLUMN_TYPES.map(({ key, icon: Icon }) => (
            <span
              key={key}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2 text-muted-foreground",
                key === "currency" && "bg-accent text-accent-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {t(`howItWorks.types.${key}`)}
            </span>
          ))}
        </MiniUi>
      ),
    },
    {
      key: "find",
      ui: (
        <MiniUi className="space-y-2.5">
          <div className="flex h-9 items-center gap-2 rounded-lg border border-input px-3">
            <Search className="size-3.5 text-muted-foreground" />
            {t("howItWorks.filterExample.query")}
          </div>
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">
              {t("howItWorks.filterExample.chip")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("howItWorks.filterExample.result")}
            </span>
          </div>
        </MiniUi>
      ),
    },
  ] as const;

  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-title"
      className="scroll-mt-16 border-t border-border bg-secondary/50"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-2xl">
          <h2
            id="como-funciona-title"
            className="text-3xl font-semibold tracking-[-0.025em] text-balance sm:text-5xl"
          >
            {t("howItWorks.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("howItWorks.description")}</p>
        </div>

        <ol className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
          {steps.map(({ key, ui }, index) => (
            <li key={key} className="border-t border-foreground/15 pt-6">
              <span className="text-sm font-semibold text-primary tabular-nums">{index + 1}</span>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">
                {t(`howItWorks.steps.${key}.title`)}
              </h3>
              <p className="mt-2 leading-7 text-muted-foreground">
                {t(`howItWorks.steps.${key}.description`)}
              </p>
              {ui}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
