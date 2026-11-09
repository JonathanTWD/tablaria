import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { GridBackdrop } from "@/components/GridBackdrop";
import { buttonVariants } from "@/components/ui/button-variants";
import { TryDemoButton } from "@/features/auth/TryDemoButton";
import { cn } from "@/lib/utils";

export function FinalCta() {
  const { t } = useTranslation("landing");

  return (
    <section aria-labelledby="cta-title" className="px-4 pb-20 sm:px-6">
      <div
        data-reveal
        className="relative isolate mx-auto flex max-w-landing flex-col items-center overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center sm:px-12 sm:py-24"
      >
        <GridBackdrop className="[mask-image:radial-gradient(ellipse_60%_80%_at_50%_0%,black,transparent_80%)]" />
        <h2
          id="cta-title"
          className="text-3xl font-semibold tracking-[-0.025em] text-balance sm:text-5xl 2xl:text-landing-title"
        >
          {t("cta.title")}
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">{t("cta.description")}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link to="/register" className={cn(buttonVariants(), "h-11 px-5 text-[0.95rem]")}>
            {t("cta.action")}
          </Link>
          <TryDemoButton variant="outline" className="h-11 px-5 text-[0.95rem]" />
        </div>
      </div>
    </section>
  );
}
