import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { GridBackdrop } from "@/components/GridBackdrop";
import { buttonVariants } from "@/components/ui/button-variants";
import { TryDemoButton } from "@/features/auth/TryDemoButton";
import { cn } from "@/lib/utils";
import { DemoInventoryTable } from "../DemoInventoryTable";
import { useDemoDataset } from "../use-demo-dataset";

export function HeroSection() {
  const { t, i18n } = useTranslation("landing");
  const dataset = useDemoDataset("shop");

  return (
    <section
      aria-labelledby="hero-title"
      // Tall monitors: the hero takes most of the first screen and still shows the next section.
      className="relative isolate flex flex-col justify-center overflow-hidden [@media(min-height:75rem)]:min-h-[min(calc(100svh-4rem),56rem)]"
    >
      <GridBackdrop />

      <div className="mx-auto grid w-full max-w-landing gap-14 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-12 lg:pt-16 lg:pb-24">
        <div className="max-w-2xl 2xl:max-w-3xl">
          <h1
            id="hero-title"
            className="text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[3.6rem] xl:text-[4.1rem] 2xl:text-landing-hero"
          >
            {t("hero.title")}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground 2xl:max-w-2xl 2xl:text-xl 2xl:leading-9">
            {t("hero.description")}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <TryDemoButton className="h-11 px-5 text-[0.95rem]" />
            <Link
              to="/register"
              className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5 text-[0.95rem]")}
            >
              {t("hero.secondary")}
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{t("hero.free")}</p>
        </div>

        <div
          id="demo"
          className="scroll-mt-24 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-700"
        >
          {/* Remount on language change: the table copies its dataset into state. */}
          <DemoInventoryTable key={i18n.language} dataset={dataset} />
        </div>
      </div>
    </section>
  );
}
