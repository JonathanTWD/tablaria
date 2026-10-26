import { House, Menu, Settings } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet } from "react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserMenu } from "@/features/auth/UserMenu";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/app", end: true, icon: House, label: "nav.dashboard" },
  { to: "/app/settings", end: false, icon: Settings, label: "nav.settings" },
] as const;

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation("app");
  return (
    <nav aria-label={t("nav.label")} className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-ring",
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
            )
          }
        >
          <Icon aria-hidden="true" className="size-4" />
          {t(label)}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col gap-6 p-3">
      <Link
        to="/app"
        onClick={onNavigate}
        aria-label={t("homeLink")}
        className="w-fit rounded-md px-2.5 pt-2"
      >
        <Logo />
      </Link>
      <SidebarNav onNavigate={onNavigate} />
      <div className="mt-auto">
        <UserMenu />
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { t } = useTranslation(["app", "common"]);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("nav.skipToContent")}
      </a>

      <aside className="sticky top-0 hidden h-dvh border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur sm:px-6">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 lg:hidden"
                  aria-label={t("nav.openMenu")}
                />
              }
            >
              <Menu aria-hidden="true" />
            </SheetTrigger>
            <SheetContent
              side="left"
              closeLabel={t("common:close")}
              className="w-72 bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetTitle className="sr-only">{t("nav.label")}</SheetTitle>
              <SidebarContent onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link
            to="/app"
            aria-label={t("common:homeLink")}
            className="rounded-md lg:hidden"
          >
            <Logo />
          </Link>
          <ThemeToggle className="ml-auto" />
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="w-full max-w-5xl px-4 py-8 outline-none sm:px-8 sm:py-10"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
