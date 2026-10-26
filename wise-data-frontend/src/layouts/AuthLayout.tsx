import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router";
import { InventoryPreview } from "@/components/InventoryPreview";
import { Logo } from "@/components/Logo";
import { useFocusOnNavigate } from "@/hooks/use-focus-on-navigate";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

/** Split screen: the product on the left (large screens), the form on the right. */
export default function AuthLayout() {
  const { t } = useTranslation();
  const mainRef = useFocusOnNavigate<HTMLElement>();

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between gap-12 bg-brand-navy p-10 text-brand-navy-foreground lg:flex xl:p-14">
        <Link to="/" aria-label={t("homeLink")} className="w-fit rounded-md">
          <Logo />
        </Link>
        <div className="space-y-8">
          <div className="max-w-md space-y-3">
            {/* Not a heading: it would precede the page's h1 in the outline. */}
            <p className="text-3xl font-semibold leading-tight tracking-tight">
              {t("preview.title")}
            </p>
            <p className="text-base leading-7 text-white/70">
              {t("preview.description")}
            </p>
          </div>
          <InventoryPreview />
        </div>
      </aside>

      <div className="flex flex-col px-4 py-5 sm:px-8">
        <header className="flex items-center justify-between lg:justify-end">
          <Link
            to="/"
            aria-label={t("homeLink")}
            className="rounded-md lg:hidden"
          >
            <Logo />
          </Link>
          <ThemeToggle />
        </header>
        <main
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 outline-none"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
