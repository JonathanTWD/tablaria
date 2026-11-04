import type { StockAlerts } from "@tablaria/shared";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

/**
 * How many records run low and in which tables, linking to each table's
 * metrics, where they are listed (ADR-035). Hidden when nothing runs low.
 */
export function StockAlertsNotice({
  alerts,
  className,
}: {
  alerts: StockAlerts | undefined;
  className?: string;
}) {
  const { t } = useTranslation("app");

  if (!alerts) {
    return (
      <p role="status" className={cn("text-sm text-muted-foreground", className)}>
        {t("dashboard.alerts.loadError")}
      </p>
    );
  }
  if (alerts.total === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby="stock-alerts-notice"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-500/10",
        className,
      )}
    >
      <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
      <h2 id="stock-alerts-notice" className="font-semibold text-amber-900 dark:text-amber-100">
        {t("dashboard.alerts.notice", { count: alerts.total })}
      </h2>
      <span className="text-amber-900/80 dark:text-amber-100/80">
        {t("dashboard.alerts.noticeHint")}
      </span>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {alerts.tables.map(({ tableId, tableName, count }) => (
          <li key={tableId}>
            <Link
              to={`/app/tables/${tableId}/metrics`}
              className="font-medium text-amber-900 underline underline-offset-4 hover:text-amber-950 focus-visible:outline-2 focus-visible:outline-ring dark:text-amber-100 dark:hover:text-white"
            >
              {t("dashboard.alerts.noticeTable", { table: tableName, count })}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
