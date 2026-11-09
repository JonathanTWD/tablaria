import { useQuery } from "@tanstack/react-query";
import type { TableDetail } from "@tablaria/shared";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router";
import { FormAlert } from "@/components/form/FormAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupsChart } from "@/features/metrics/GroupsChart";
import { metricsSummaryQuery } from "@/features/metrics/queries";
import { SummaryCards } from "@/features/metrics/SummaryCards";
import { TimelineChart } from "@/features/metrics/TimelineChart";
import { tableStockAlertsQuery } from "@/features/stock-alerts/queries";
import { StockAlertsCard } from "@/features/stock-alerts/StockAlertsCard";
import { upcomingDatesQuery } from "@/features/upcoming-dates/queries";
import { UpcomingDatesCard } from "@/features/upcoming-dates/UpcomingDatesCard";

/** The table's metrics (ADR-035): what its numbers say, by group and over time. */
export default function MetricsPage() {
  const { t } = useTranslation("records");
  const table = useOutletContext<TableDetail>();
  const summary = useQuery(metricsSummaryQuery(table.id));
  // Only tables with a low-stock threshold have alerts to show.
  const hasThresholds = table.columns.some(
    (column) => column.type === "number" && column.options !== null,
  );
  const alerts = useQuery({ ...tableStockAlertsQuery(table.id), enabled: hasThresholds });
  // Only tables with a date warning have upcoming dates to show (ADR-048).
  const hasDateWarnings = table.columns.some(
    (column) => column.type === "date" && column.options !== null,
  );
  const upcoming = useQuery({ ...upcomingDatesQuery(table.id), enabled: hasDateWarnings });

  return (
    <div className="@container mt-6 flex flex-col gap-6">
      <title>{`${t("tabs.metrics")} · ${table.name} | Tablaria`}</title>
      {summary.isPending ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : summary.isError ? (
        <FormAlert>{t("metrics.loadError")}</FormAlert>
      ) : (
        <SummaryCards
          table={table}
          summary={summary.data}
          alerts={hasThresholds ? alerts.data : undefined}
          upcoming={hasDateWarnings ? upcoming.data : undefined}
        />
      )}

      {hasThresholds && alerts.data && alerts.data.total > 0 && (
        <StockAlertsCard alerts={alerts.data} showTable={false} />
      )}

      {hasDateWarnings && upcoming.data && upcoming.data.total > 0 && (
        <UpcomingDatesCard upcoming={upcoming.data} showTable={false} />
      )}

      {table.recordCount === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          {t("metrics.noRecords")}
        </p>
      ) : (
        <div className="grid gap-6 @5xl:grid-cols-2">
          <GroupsChart table={table} />
          <TimelineChart table={table} />
        </div>
      )}
    </div>
  );
}
