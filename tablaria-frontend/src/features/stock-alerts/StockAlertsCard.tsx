import { stockLevelFor, type StockAlert, type StockAlerts } from "@tablaria/shared";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

/** Records running low; hidden when nothing is below its threshold. */
export function StockAlertsCard({
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
  const { items, total } = alerts;

  return (
    <section
      aria-labelledby="stock-alerts-title"
      className={cn("rounded-xl border border-amber-500/40 bg-card", className)}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
        <TriangleAlert aria-hidden="true" className="size-4 text-amber-600 dark:text-amber-400" />
        <h2 id="stock-alerts-title" className="font-semibold tracking-tight">
          {t("dashboard.alerts.title")}
        </h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {t("dashboard.alerts.count", { count: total })}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((alert) => (
          <AlertRow key={`${alert.recordId}-${alert.columnName}`} alert={alert} />
        ))}
      </ul>
      {total > items.length && (
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
          {t("dashboard.alerts.more", { count: total - items.length })}
        </p>
      )}
    </section>
  );
}

function AlertRow({ alert }: { alert: StockAlert }) {
  const { t, i18n } = useTranslation(["app", "records"]);
  const number = new Intl.NumberFormat(i18n.language);
  const out = stockLevelFor(alert.value, alert.alertBelow) === "out";
  const Icon = out ? CircleAlert : TriangleAlert;

  return (
    <li>
      <Link
        to={`/app/tables/${alert.tableId}`}
        className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {alert.label || t("records:table.untitled")}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {alert.tableName} · {alert.columnName}
          </span>
        </span>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 text-right font-medium tabular-nums",
            out ? "text-destructive" : "text-amber-700 dark:text-amber-400",
          )}
        >
          <Icon aria-hidden="true" className="size-3.5" />
          {out
            ? t("dashboard.alerts.out")
            : t("dashboard.alerts.low", {
                count: alert.value,
                value: number.format(alert.value),
                min: number.format(alert.alertBelow),
              })}
        </span>
      </Link>
    </li>
  );
}
