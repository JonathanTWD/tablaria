import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Ellipsis, Pencil, Rows3, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
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
import { ColumnList } from "@/features/columns/ColumnList";
import { DeleteTableDialog } from "@/features/tables/DeleteTableDialog";
import { EditTableDialog } from "@/features/tables/EditTableDialog";
import { tableQuery } from "@/features/tables/queries";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function TablePage() {
  const { t, i18n } = useTranslation("tables");
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

      <ColumnList table={data} />

      <section aria-labelledby="records-title" className="mt-10">
        <h2 id="records-title" className="text-lg font-semibold tracking-tight">
          {t("page.recordsTitle")}
        </h2>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-border px-6 py-8 text-sm text-muted-foreground">
          <Rows3 aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.5} />
          {t("page.recordsEmpty")}
        </div>
      </section>

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
