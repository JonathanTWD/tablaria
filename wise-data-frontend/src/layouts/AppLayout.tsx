import { useQuery } from "@tanstack/react-query";
import { hasRole } from "@wisedata/shared";
import { House, Plus, Settings, Table2, Users } from "lucide-react";
import { type CSSProperties, type RefObject, Suspense, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router";
import { FullPageLoader } from "@/components/FullPageLoader";
import { Logo } from "@/components/Logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useFocusOnNavigate } from "@/hooks/use-focus-on-navigate";
import { DemoBanner } from "@/features/auth/DemoBanner";
import { RealtimeProvider } from "@/features/realtime/RealtimeProvider";
import { UserMenu } from "@/features/auth/UserMenu";
import { SpaceProvider } from "@/features/organizations/SpaceProvider";
import { SpaceSwitcher } from "@/features/organizations/SpaceSwitcher";
import { useSpace } from "@/features/organizations/space-context";
import { sharedTablesQuery } from "@/features/sharing/queries";
import { CreateTableDialog } from "@/features/tables/CreateTableDialog";
import { tablesQuery } from "@/features/tables/queries";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

const NAV_ITEMS = [
  { to: "/app", end: true, icon: House, label: "nav.dashboard" },
  { to: "/app/settings", end: false, icon: Settings, label: "nav.settings" },
] as const;

const SIDEBAR_STORAGE_KEY = "wisedata:sidebar-open";

/** The saved choice; without one, expanded only where the content still has room (≥ 1024 px). */
function readSidebarOpen(): boolean {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, site data disabled): fall back to the screen width.
  }
  return saved === null ? window.matchMedia("(min-width: 1024px)").matches : saved === "true";
}

function saveSidebarOpen(open: boolean) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
  } catch {
    // Storage blocked: the choice only lasts until the page reloads.
  }
}

function isCurrent(pathname: string, to: string, end: boolean) {
  return end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

/** Closes the phone sheet after following a link; on desktop the sidebar stays as it is. */
function useCloseOnPhone() {
  const { isMobile, setOpenMobile } = useSidebar();
  return () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
}

function MainNav() {
  const { t } = useTranslation("app");
  const { pathname } = useLocation();
  const close = useCloseOnPhone();

  return (
    <SidebarGroup>
      <nav aria-label={t("nav.label")}>
        <SidebarMenu>
          {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => {
            const current = isCurrent(pathname, to, end);
            return (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton
                  isActive={current}
                  tooltip={t(label)}
                  render={
                    <Link to={to} onClick={close} aria-current={current ? "page" : undefined} />
                  }
                >
                  <Icon aria-hidden="true" />
                  <span>{t(label)}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </nav>
    </SidebarGroup>
  );
}

/** The tables of the space chosen in the switcher. */
function TablesNav() {
  const { t } = useTranslation("tables");
  const { space } = useSpace();
  const tables = useQuery({ ...tablesQuery(space?.id ?? ""), enabled: Boolean(space) });
  const shared = useQuery(sharedTablesQuery);
  // Viewers and editors of an organization don't create its tables.
  const canCreate = space !== undefined && hasRole(space.role, "ADMIN");
  const { pathname } = useLocation();
  const { state, isMobile } = useSidebar();
  const close = useCloseOnPhone();
  const collapsed = state === "collapsed" && !isMobile;

  // In the icon rail every table would show the same icon, so they collapse into one menu.
  if (collapsed) {
    return (
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <SidebarMenuButton
                tooltip={t("sidebar.title")}
                aria-label={t("sidebar.title")}
                render={<DropdownMenuTrigger />}
              >
                <Table2 aria-hidden="true" />
              </SidebarMenuButton>
              <DropdownMenuContent side="right" align="start" className="w-60">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t("sidebar.title")}</DropdownMenuLabel>
                  {tables.isError && (
                    <DropdownMenuItem disabled>{t("sidebar.loadError")}</DropdownMenuItem>
                  )}
                  {tables.data?.map((table) => (
                    <DropdownMenuItem
                      key={table.id}
                      render={<Link to={`/app/tables/${table.id}`} />}
                    >
                      <Table2 aria-hidden="true" />
                      <span className="truncate">{table.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                {shared.data && shared.data.length > 0 && (
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("sidebar.shared")}</DropdownMenuLabel>
                    {shared.data.map((table) => (
                      <DropdownMenuItem
                        key={table.id}
                        render={<Link to={`/app/tables/${table.id}`} />}
                      >
                        <Users aria-hidden="true" />
                        <span className="truncate">{table.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          {canCreate && (
            <SidebarMenuItem>
              <CreateTableDialog
 organizationId={space.id}
                trigger={
                  <SidebarMenuButton tooltip={t("create.open")} aria-label={t("create.open")}>
                    <Plus aria-hidden="true" />
                  </SidebarMenuButton>
                }
              />
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <nav aria-labelledby="sidebar-tables-label">
        {/* Not a heading: it would precede the page's h1 in the outline. */}
        <SidebarGroupLabel id="sidebar-tables-label" render={<p />}>
          {t("sidebar.title")}
        </SidebarGroupLabel>
        {canCreate && (
          <CreateTableDialog
 organizationId={space.id}
            onCreated={close}
            trigger={
              <SidebarGroupAction aria-label={t("create.open")}>
                <Plus aria-hidden="true" />
              </SidebarGroupAction>
            }
          />
        )}
        <SidebarGroupContent>
          {tables.isError && (
            <p className="px-2 py-2 text-xs text-muted-foreground">{t("sidebar.loadError")}</p>
          )}
          <SidebarMenu>
            {tables.data?.map((table) => {
              const to = `/app/tables/${table.id}`;
              const current = isCurrent(pathname, to, false);
              return (
                <SidebarMenuItem key={table.id}>
                  <SidebarMenuButton
                    isActive={current}
                    render={
                      <Link to={to} onClick={close} aria-current={current ? "page" : undefined} />
                    }
                  >
                    <Table2 aria-hidden="true" />
                    <span>{table.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </nav>
    </SidebarGroup>
  );
}

/** Tables other people shared with the user; hidden when there are none. */
function SharedTablesNav() {
  const { t } = useTranslation("tables");
  const shared = useQuery(sharedTablesQuery);
  const { pathname } = useLocation();
  const { state, isMobile } = useSidebar();
  const close = useCloseOnPhone();

  // Collapsed, they are listed in the "Tablas" menu.
  if (!shared.data?.length || (state === "collapsed" && !isMobile)) {
    return null;
  }
  return (
    <SidebarGroup>
      <nav aria-labelledby="sidebar-shared-label">
        <SidebarGroupLabel id="sidebar-shared-label" render={<p />}>
          {t("sidebar.shared")}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {shared.data.map((table) => {
              const to = `/app/tables/${table.id}`;
              const current = isCurrent(pathname, to, false);
              return (
                <SidebarMenuItem key={table.id}>
                  <SidebarMenuButton
                    isActive={current}
                    render={
                      <Link to={to} onClick={close} aria-current={current ? "page" : undefined} />
                    }
                  >
                    <Users aria-hidden="true" />
                    <span>{table.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </nav>
    </SidebarGroup>
  );
}

function AppSidebar() {
  const { t } = useTranslation(["app", "common"]);
  const close = useCloseOnPhone();

  return (
    <Sidebar
      collapsible="icon"
      mobileTitle={t("sidebar.title")}
      mobileDescription={t("sidebar.description")}
    >
      <SidebarHeader>
        <Link
          to="/app"
          onClick={close}
          aria-label={t("common:homeLink")}
          className="w-fit rounded-md px-2 pt-2 group-data-[collapsible=icon]:px-1"
        >
          <Logo />
        </Link>
        <SpaceSwitcher onNavigate={close} />
      </SidebarHeader>
      <SidebarContent>
        <MainNav />
        <TablesNav />
        <SharedTablesNav />
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail aria-label={t("sidebar.toggle")} title={t("sidebar.toggle")} />
    </Sidebar>
  );
}

function AppHeader({ triggerRef }: { triggerRef: RefObject<HTMLButtonElement | null> }) {
  const { t } = useTranslation(["app", "common"]);
  const { open, openMobile, isMobile } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur sm:px-6">
      <SidebarTrigger
        ref={triggerRef}
        className="size-9"
        aria-label={t("sidebar.toggle")}
        aria-expanded={isMobile ? openMobile : open}
      />
      <Link to="/app" aria-label={t("common:homeLink")} className="rounded-md md:hidden">
        <Logo />
      </Link>
      <ThemeToggle className="ml-auto" />
    </header>
  );
}

export default function AppLayout() {
  const { t } = useTranslation("app");
  const mainRef = useFocusOnNavigate<HTMLElement>();
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={(open) => {
        if (!open && document.activeElement?.closest('[data-sidebar="sidebar"]')) {
          triggerRef.current?.focus();
        }
        setSidebarOpen(open);
        saveSidebarOpen(open);
      }}
      // Same width as before the collapsible sidebar, so the page layouts keep their measurements.
      style={{ "--sidebar-width": "15rem" } as CSSProperties}
      className="min-h-dvh bg-background"
    >
      <SpaceProvider>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("nav.skipToContent")}
      </a>

      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader triggerRef={triggerRef} />
        <DemoBanner />

        <main
          ref={mainRef}
          id="main"
          tabIndex={-1}
          className="w-full px-4 py-8 outline-none sm:px-8"
        >
          {/* One connection for the whole session, whatever page is loading. */}
          <RealtimeProvider>
            {/* Keeps the sidebar and header on screen while a page's code loads. */}
            <Suspense fallback={<FullPageLoader className="min-h-64" />}>
              <Outlet />
            </Suspense>
          </RealtimeProvider>
        </main>
      </div>
      </SpaceProvider>
    </SidebarProvider>
  );
}
