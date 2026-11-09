import { useQuery } from "@tanstack/react-query";
import { hasRole } from "@tablaria/shared";
import { ArrowLeft, Building2, Ellipsis, LogOut, Pencil, Sparkles, Trash2, UserPlus } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router";
import { FullPageLoader } from "@/components/FullPageLoader";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssistant } from "@/features/assistant/assistant-context";
import { PresenceAvatars } from "@/features/realtime/PresenceAvatars";
import {
  type RealtimeStatus,
  useRealtimeTable,
  useTablePresence,
} from "@/features/realtime/realtime-context";
import { useSession } from "@/features/auth/session";
import { useSpace } from "@/features/organizations/space-context";
import { LeaveTableDialog } from "@/features/sharing/LeaveTableDialog";
import { ShareDialog } from "@/features/sharing/ShareDialog";
import { DeleteTableDialog } from "@/features/tables/DeleteTableDialog";
import { EditTableDialog } from "@/features/tables/EditTableDialog";
import { tableQuery } from "@/features/tables/queries";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Header and tabs of a table; the records or columns view renders below. */
export default function TablePage() {
  const { t, i18n } = useTranslation(["tables", "records", "assistant", "calendar"]);
  const { tableId = "" } = useParams();
  const table = useQuery(tableQuery(tableId));
  const realtime = useRealtimeTable(tableId);
  const { viewers } = useTablePresence(tableId);
  const { data: user } = useSession();
  const others = viewers.filter(({ userId }) => userId !== user?.id);
  const [dialog, setDialog] = useState<"share" | "edit" | "delete" | "leave" | null>(null);
  const navigate = useNavigate();
  const assistant = useAssistant();
  const { space, setSpaceId } = useSpace();
  // Tables shared with the user stay outside their spaces.
  const tableSpace = table.data?.member ? table.data.organizationId : undefined;

  // Opening a table of another space switches to it, so the sidebar lists the tables next to it.
  useEffect(() => {
    if (tableSpace && space && tableSpace !== space.id) {
      setSpaceId(tableSpace);
    }
  }, [tableSpace, space, setSpaceId]);

  const backLink = (
    <Link
      to="/app"
      className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring lg:hidden"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {t("page.back")}
    </Link>
  );

  if (table.isPending) {
    return (
      <div aria-busy="true">
        {backLink}
        <Skeleton className="mt-4 h-8 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-48" />
        <Skeleton className="mt-12 h-6 w-32" />
        <Skeleton className="mt-4 h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (table.isError) {
    // A malformed id (400) is as unknown as a missing or foreign table (404).
    const notFound =
      table.error instanceof ApiError && (table.error.status === 404 || table.error.status === 400);
    return (
      <>
        <title>{`${notFound ? t("page.notFoundTitle") : t("page.loadError")} | Tablaria`}</title>
        {backLink}
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {notFound ? t("page.notFoundTitle") : t("page.loadError")}
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
          {notFound ? t("page.notFoundDescription") : apiErrorMessage(table.error)}
        </p>
        {notFound ? (
          <Link to="/app" className={cn(buttonVariants(), "mt-6 h-9")}>
            {t("page.back")}
          </Link>
        ) : (
          <Button className="mt-6 h-9" onClick={() => void table.refetch()}>
            {t("page.retry")}
          </Button>
        )}
      </>
    );
  }

  const { data } = table;
  const manages = hasRole(data.role, "ADMIN");
  const meta = [
    // Without admin rights, the user sees what they can do and, for shared tables, why.
    !manages &&
      t(data.member ? "page.yourRole" : "page.sharedWithYou", {
        role: t(`share.roles.${data.role}`),
      }),
    t("count.columns", { count: data.columnCount }),
    t("count.records", { count: data.recordCount }),
    t("edited", { time: formatRelativeTime(data.updatedAt, i18n.language) }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    // Full width for wide tables, bounded so ultrawide screens don't spread a few columns apart.
    <div className="mx-auto w-full max-w-[160rem]">
      <title>{`${data.name} | Tablaria`}</title>
      {backLink}

      <div className="mt-4 flex items-start justify-between gap-4 lg:mt-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{data.name}</h1>
            <RealtimeBadge status={realtime} />
          </div>
          {data.description && (
            <p className="mt-1.5 max-w-prose text-sm leading-6 text-muted-foreground">
              {data.description}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{meta}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PresenceAvatars viewers={others} />
          {/* Sharing is the main action of an owner's table, so it isn't tucked into the menu. */}
          {manages && (
            <Button className="h-10" onClick={() => setDialog("share")}>
              <UserPlus aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t("page.share")}</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon-lg" aria-label={t("page.actions")} />
              }
            >
              <Ellipsis aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {assistant.enabled && (
                <>
                  <DropdownMenuItem onClick={assistant.open}>
                    <Sparkles aria-hidden="true" />
                    {t("assistant:askTable")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {manages ? (
                <>
                  <DropdownMenuItem onClick={() => setDialog("edit")}>
                    <Pencil aria-hidden="true" />
                    {t("edit.open")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
                    <Trash2 aria-hidden="true" />
                    {t("delete.open")}
                  </DropdownMenuItem>
                </>
              ) : data.member ? (
                // Access comes from the organization: it's left from its page.
                <DropdownMenuItem
                  onClick={() => void navigate(`/app/organizations/${data.organizationId}`)}
                >
                  <Building2 aria-hidden="true" />
                  {t("page.organization")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem variant="destructive" onClick={() => setDialog("leave")}>
                  <LogOut aria-hidden="true" />
                  {t("page.leave")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Scrolls sideways on phones; the inset line stays under the tabs as they scroll. */}
      <nav
        aria-label={t("records:tabs.label")}
        className="mt-5 flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)] [scrollbar-width:none]"
      >
        {[
          { to: "", end: true, label: t("records:tabs.records") },
          { to: "columns", end: false, label: t("records:tabs.columns") },
          // Only tables with dates have something to put on a calendar.
          data.columns.some(({ type }) => type === "date") && {
            to: "calendar",
            end: false,
            label: t("calendar:tab"),
          },
          { to: "metrics", end: false, label: t("records:tabs.metrics") },
          { to: "activity", end: false, label: t("records:tabs.activity") },
        ]
          .filter((tab) => tab !== false)
          .map(({ to, end, label }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <Suspense fallback={<FullPageLoader className="min-h-48" />}>
        <Outlet context={data} />
      </Suspense>

      {manages && (
        <ShareDialog
          table={data}
          open={dialog === "share"}
          onOpenChange={(open) => setDialog(open ? "share" : null)}
        />
      )}
      {!manages && !data.member && (
        <LeaveTableDialog
          table={data}
          open={dialog === "leave"}
          onOpenChange={(open) => setDialog(open ? "leave" : null)}
        />
      )}
      <EditTableDialog
        table={data}
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
      />
      <DeleteTableDialog
        table={data}
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
      />
    </div>
  );
}

/** Whether changes by others show up on their own; nothing while first connecting. */
function RealtimeBadge({ status }: { status: RealtimeStatus }) {
  const { t } = useTranslation("tables");
  if (status === "connecting") {
    return null;
  }
  const live = status === "live";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          live ? "bg-green-500 motion-safe:animate-pulse" : "bg-amber-500",
        )}
      />
      {live ? t("page.live") : t("page.offline")}
    </span>
  );
}
