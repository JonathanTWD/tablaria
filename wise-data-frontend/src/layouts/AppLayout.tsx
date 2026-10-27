import { useQuery } from "@tanstack/react-query";
import { House, Menu, Plus, Settings, Table2 } from "lucide-react";
import { Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet } from "react-router";
import { FullPageLoader } from "@/components/FullPageLoader";
import { Logo } from "@/components/Logo";
import { useFocusOnNavigate } from "@/hooks/use-focus-on-navigate";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserMenu } from "@/features/auth/UserMenu";
import { CreateTableDialog } from "@/features/tables/CreateTableDialog";
import { tablesQuery } from "@/features/tables/queries";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/app", end: true, icon: House, label: "nav.dashboard" },
  { to: "/app/settings", end: false, icon: Settings, label: "nav.settings" },
] as const;

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-ring",
    isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
  );

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation("app");
  return (
    <nav aria-label={t("nav.label")} className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={end} onClick={onNavigate} className={navLinkClass}>
          <Icon aria-hidden="true" className="size-4" />
          {t(label)}
        </NavLink>
      ))}
    </nav>
  );
}

function TablesNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation("tables");
  const tables = useQuery(tablesQuery);

  return (
    <nav aria-labelledby="sidebar-tables" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between pr-1 pl-2.5">
        {/* Not a heading: it would precede the page's h1 in the outline. */}
        <p id="sidebar-tables" className="text-xs font-medium text-muted-foreground">
          {t("sidebar.title")}
        </p>
        <CreateTableDialog
          onCreated={onNavigate}
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={t("create.open")}>
              <Plus aria-hidden="true" />
            </Button>
          }
        />
      </div>
      {tables.isError && (
        <p className="px-2.5 py-2 text-xs text-muted-foreground">{t("sidebar.loadError")}</p>
      )}
      <ul className="mt-1 flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {tables.data?.map((table) => (
          <li key={table.id}>
            <NavLink to={`/app/tables/${table.id}`} onClick={onNavigate} className={navLinkClass}>
              <Table2 aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">{table.name}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-0 flex-col gap-6 p-3">
      <Link
        to="/app"
        onClick={onNavigate}
        aria-label={t("homeLink")}
        className="w-fit rounded-md px-2.5 pt-2"
      >
        <Logo />
      </Link>
      <SidebarNav onNavigate={onNavigate} />
      <TablesNav onNavigate={onNavigate} />
      <div className="mt-auto">
        <UserMenu />
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { t } = useTranslation(["app", "common"]);
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useFocusOnNavigate<HTMLElement>();

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
          ref={mainRef}
          id="main"
          tabIndex={-1}
          className="w-full max-w-5xl px-4 py-8 outline-none sm:px-8 sm:py-10"
        >
          {/* Keeps the sidebar and header on screen while a page's code loads. */}
          <Suspense fallback={<FullPageLoader className="min-h-64" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
