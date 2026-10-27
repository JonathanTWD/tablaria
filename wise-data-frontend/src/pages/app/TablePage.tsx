import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Ellipsis, Pencil, Trash2 } from "lucide-react";
import { Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useParams } from "react-router";
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
import { DeleteTableDialog } from "@/features/tables/DeleteTableDialog";
import { EditTableDialog } from "@/features/tables/EditTableDialog";
import { tableQuery } from "@/features/tables/queries";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Header and tabs of a table; the records or columns view renders below. */
export default function TablePage() {
  const { t, i18n } = useTranslation(["tables", "records"]);
  const { tableId = "" } = useParams();
  const table = useQuery(tableQuery(tableId));
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);

  const backLink = (
    <Link
      to="/app"
      className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
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
        <title>{`${notFound ? t("page.notFoundTitle") : t("page.loadError")} | WiseData`}</title>
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
  const meta = [
    t("count.columns", { count: data.columnCount }),
    t("count.records", { count: data.recordCount }),
    t("edited", { time: formatRelativeTime(data.updatedAt, i18n.language) }),
  ].join(" · ");

  return (
    <>
      <title>{`${data.name} | WiseData`}</title>
      {backLink}

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{data.name}</h1>
          {data.description && (
            <p className="mt-1.5 max-w-prose text-sm leading-6 text-muted-foreground">
              {data.description}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{meta}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon-lg" aria-label={t("page.actions")} />
            }
          >
            <Ellipsis aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onClick={() => setDialog("edit")}>
              <Pencil aria-hidden="true" />
              {t("edit.open")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
              <Trash2 aria-hidden="true" />
              {t("delete.open")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav aria-label={t("records:tabs.label")} className="mt-6 flex gap-1 border-b border-border">
        {[
          { to: "", end: true, label: t("records:tabs.records") },
          { to: "columns", end: false, label: t("records:tabs.columns") },
        ].map(({ to, end, label }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
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
    </>
  );
}
