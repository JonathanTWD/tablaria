import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import Lightfall from "../react-bits/Lightfall";

// Module-level so the WebGL effect is not rebuilt on every render (it depends on this array).
const LIGHTFALL_COLORS = ["#8bbcff", "#3024ff", "#d672ff"];

const Hero = () => {
  const { t } = useTranslation("landing");
  const reducedMotion = usePrefersReducedMotion();

  return (
    <section className="relative z-0 flex min-h-dvh items-center overflow-hidden bg-brand-navy">
      <div aria-hidden="true" className="absolute inset-0">
        <Lightfall
          mouseInteraction={false}
          paused={reducedMotion}
          backgroundColor="#020208"
          colors={LIGHTFALL_COLORS}
          speed={0.2}
        />
      </div>
      {/* Darkens the streaks behind the copy so the text keeps its contrast. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(2,2,8,0.6),transparent_70%)] lg:bg-[radial-gradient(ellipse_at_25%_50%,rgba(2,2,8,0.6),transparent_60%)]"
      />

      <div className="relative flex w-full justify-center px-6 pb-16 pt-32 text-center lg:justify-start lg:px-[8vw] lg:py-32 lg:text-start">
        <div className="flex max-w-xl flex-col items-center lg:items-start">
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl xl:text-6xl">
            {t("hero.titleLine1")}
            <span className="block bg-linear-to-r from-blue-200 via-white to-fuchsia-200 bg-clip-text text-transparent">
              {t("hero.titleLine2")}
            </span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-blue-100/75 sm:text-lg">
            {t("hero.description")}
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-blue-950/30 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              {t("hero.primary")}
            </Link>
            <a
              href="#funciones"
              className="rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {t("hero.secondary")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
