import type { UpcomingDate, UpcomingDates } from "@tablaria/shared";
import { CalendarClock } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

/** Dates coming within their column's warning (ADR-048); hidden when none is near. */
export function UpcomingDatesCard({
  upcoming,
  showTable = true,
  limit,
  id,
  className,
}: {
  upcoming: UpcomingDates | undefined;
  /** Off inside a table, where every date is of that table. */
  showTable?: boolean;
  /** Fewer rows than the API sends, where space is short (Inicio). */
  limit?: number;
  /** Lets a link elsewhere on the page point at the card. */
  id?: string;
  className?: string;
}) {
  const { t } = useTranslation("app");
  const titleId = useId();

  if (!upcoming) {
    return (
      <p role="status" className={cn("text-sm text-muted-foreground", className)}>
        {t("dashboard.upcoming.loadError")}
      </p>
    );
  }
  if (upcoming.total === 0) {
    return null;
  }
  const { total } = upcoming;
  const items = upcoming.items.slice(0, limit);

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn("scroll-mt-20 rounded-xl border border-border bg-card", className)}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
        <CalendarClock aria-hidden="true" className="size-4 text-primary" />
        <h2 id={titleId} className="font-semibold tracking-tight">
          {t("dashboard.upcoming.title")}
        </h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {t("dashboard.upcoming.count", { count: total })}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <UpcomingRow key={`${item.recordId}-${item.columnName}`} item={item} showTable={showTable} />
        ))}
      </ul>
      {total > items.length && (
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
          {t("dashboard.upcoming.more", { count: total - items.length })}
        </p>
      )}
    </section>
  );
}

function UpcomingRow({ item, showTable }: { item: UpcomingDate; showTable: boolean }) {
  const { t, i18n } = useTranslation(["app", "records"]);
  // "hoy", "mañana", "dentro de 3 días"…
  const relative = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" }).format(item.daysLeft, "day");
  const date = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${item.date}T00:00:00Z`),
  );

  return (
    <li>
      <Link
        // The records page opens the record's sheet from the URL.
        to={`/app/tables/${item.tableId}?${new URLSearchParams({ record: item.recordId })}`}
        className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.label || t("records:table.untitled")}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {showTable ? `${item.tableName} · ${item.columnName}` : item.columnName}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span
            className={cn(
              "font-medium first-letter:uppercase",
              item.daysLeft <= 1 && "text-amber-700 dark:text-amber-400",
            )}
          >
            {relative}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">{date}</span>
        </span>
      </Link>
    </li>
  );
}
