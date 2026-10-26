import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { DemoInventoryTable } from "../DemoInventoryTable";
import { useDemoDataset } from "../use-demo-dataset";

export function HeroSection() {
  const { t } = useTranslation("landing");
  const dataset = useDemoDataset("shop");

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      {/* Faint spreadsheet grid: the product's own material, fading out below the copy. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:3.5rem_2.25rem] [mask-image:radial-gradient(ellipse_70%_60%_at_30%_0%,black,transparent_75%)]"
      />

      <div className="mx-auto grid max-w-7xl gap-14 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-12 lg:pt-16 lg:pb-24">
        <div className="max-w-2xl">
          <h1
            id="hero-title"
            className="text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[3.6rem] xl:text-[4.1rem]"
          >
            {t("hero.title")}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            {t("hero.description")}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/register" className={cn(buttonVariants(), "h-11 px-5 text-[0.95rem]")}>
              {t("hero.primary")}
            </Link>
            <a
              href="#demo"
              className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5 text-[0.95rem]")}
            >
              {t("hero.secondary")}
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{t("hero.free")}</p>
        </div>

        <div
          id="demo"
          className="scroll-mt-24 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-700"
        >
          <DemoInventoryTable dataset={dataset} />
        </div>
      </div>
    </section>
  );
}
