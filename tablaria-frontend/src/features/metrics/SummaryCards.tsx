import type { MetricsSummary, StockAlerts, TableDetail } from "@tablaria/shared";
import { useTranslation } from "react-i18next";
import { useCellFormatter } from "@/features/columns/format-value";
import { cn } from "@/lib/utils";

/**
 * The table at a glance: its records, how many run low and what each number
 * column adds up to, with its average and range.
 */
export function SummaryCards({
  table,
  summary,
  alerts,
}: {
  table: TableDetail;
  summary: MetricsSummary;
  /** Undefined while loading, or when the table has no stock thresholds. */
  alerts: StockAlerts | undefined;
}) {
  const { t, i18n } = useTranslation("records");
  const format = useCellFormatter();
  const number = new Intl.NumberFormat(i18n.language);
  const cards: { key: string; label: string; value: string; detail?: string; warn?: boolean }[] = [
    { key: "records", label: t("metrics.summary.records"), value: number.format(summary.total) },
  ];
  if (alerts) {
    cards.push({
      key: "alerts",
      label: t("metrics.summary.lowStock"),
      value: number.format(alerts.total),
      warn: alerts.total > 0,
    });
  }
  for (const stats of summary.columns) {
    const column = table.columns.find(({ id }) => id === stats.columnId);
    if (!column) {
      continue;
    }
    cards.push({
      key: column.id,
      label: t("metrics.summary.total", { name: column.name }),
      value: stats.sum === null ? "—" : format(column, stats.sum),
      detail:
        stats.avg === null || stats.min === null || stats.max === null
          ? t("metrics.summary.noValues")
          : t("metrics.summary.detail", {
              // An average of whole numbers rarely is one: two decimals are enough.
              avg: format(column, Math.round(stats.avg * 100) / 100),
              min: format(column, stats.min),
              max: format(column, stats.max),
            }),
    });
  }

  return (
    <dl className="grid grid-cols-2 gap-3 @3xl:grid-cols-3 @6xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.key} className="flex flex-col rounded-xl border border-border bg-card px-5 py-4">
          <dt className="truncate text-xs font-medium text-muted-foreground" title={card.label}>
            {card.label}
          </dt>
          <dd
            className={cn(
              "mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums",
              card.warn && "text-amber-700 dark:text-amber-400",
            )}
          >
            {card.value}
          </dd>
          {card.detail && (
            <dd className="mt-1 text-xs text-muted-foreground tabular-nums">{card.detail}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}
