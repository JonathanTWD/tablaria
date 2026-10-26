import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router";
import { GridBackdrop } from "@/components/GridBackdrop";
import { Logo } from "@/components/Logo";
import { DemoInventoryTable } from "@/features/landing/DemoInventoryTable";
import { useDemoDataset } from "@/features/landing/use-demo-dataset";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { useFocusOnNavigate } from "@/hooks/use-focus-on-navigate";

/** Form on the left; on large screens the working demo table on the right. */
export default function AuthLayout() {
  const { t, i18n } = useTranslation(["auth", "common"]);
  const mainRef = useFocusOnNavigate<HTMLElement>();
  const dataset = useDemoDataset("shop");

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="relative isolate flex flex-col px-4 py-5 sm:px-8">
        <GridBackdrop className="lg:hidden" />
        <header className="flex items-center justify-between">
          <Link to="/" aria-label={t("common:homeLink")} className="rounded-md">
            <Logo />
          </Link>
          <ThemeToggle />
        </header>
        <main
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12 outline-none"
        >
          <Outlet />
        </main>
      </div>

      <aside className="relative isolate hidden flex-col justify-center gap-10 overflow-hidden border-l border-border bg-secondary/50 px-10 py-16 lg:flex xl:px-16">
        <GridBackdrop className="[mask-image:radial-gradient(ellipse_80%_70%_at_70%_20%,black,transparent_80%)]" />
        <div className="max-w-lg">
          {/* Not a heading: it would precede the page's h1 in the outline. */}
          <p className="text-3xl leading-tight font-semibold tracking-[-0.025em] text-balance">
            {t("panel.title")}
          </p>
          <p className="mt-3 leading-7 text-muted-foreground">{t("panel.description")}</p>
        </div>
        <DemoInventoryTable key={i18n.language} dataset={dataset} />
      </aside>
    </div>
  );
}
