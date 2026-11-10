import { useQuery } from "@tanstack/react-query";
import {
  CREATED_AT,
  type TableDetail,
  TIMELINE_INTERVALS,
  type TimelineInterval,
} from "@tablaria/shared";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartData, type ChartRow } from "./ChartData";
import { ChartCard } from "./GroupsChart";
import { MetricPicker } from "./MetricPicker";
import { COUNT, useMeasure } from "./measure";
import { dateColumns, fillTimeline } from "./metric-columns";
import { timelineQuery } from "./queries";

/** How the table's records spread over time: when they were created or a date column. */
export function TimelineChart({ table }: { table: TableDetail }) {
  const { t, i18n } = useTranslation("records");
  const ids = useId();
  const [picked, setPicked] = useState<{
    date: string;
    interval: TimelineInterval;
    measure: string;
  }>({ date: CREATED_AT, interval: "month", measure: COUNT });

  const dates = dateColumns(table.columns);
  const date = dates.find(({ id }) => id === picked.date)?.id ?? CREATED_AT;
  const measure = useMeasure(table.columns, picked.measure);
  const timeline = useQuery(
    timelineQuery(table.id, {
      date,
      interval: picked.interval,
      column: measure.measure?.column.id,
      fn: measure.measure?.fn ?? "sum",
    }),
  );

  const period = new Intl.DateTimeFormat(
    i18n.language,
    picked.interval === "month"
      ? { month: "short", year: "numeric", timeZone: "UTC" }
      : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
  );
  const rows: ChartRow[] = fillTimeline(timeline.data?.buckets ?? [], picked.interval).map(
    (bucket) => {
      const value = measure.measure ? bucket.measure : bucket.count;
      const day = period.format(new Date(`${bucket.start}T00:00:00Z`));
      return {
        key: bucket.start,
        label:
          picked.interval === "week" ? t("metrics.timeline.weekOf", { day }) : day,
        value: value ?? 0,
        display: value === null ? "—" : measure.display(value),
        fill: "var(--chart-1)",
      };
    },
  );
  const dateItems: Record<string, string> = {
    [CREATED_AT]: t("metrics.timeline.createdAt"),
    ...Object.fromEntries(dates.map(({ id, name }) => [id, name])),
  };
  const caption = t("metrics.timeline.caption", {
    measure: measure.label,
    interval: t(`metrics.timeline.intervals.${picked.interval}`).toLocaleLowerCase(i18n.language),
    date: dateItems[date],
  });

  return (
    <ChartCard title={t("metrics.timeline.title")}>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricPicker
          id={`${ids}-date`}
          label={t("metrics.timeline.date")}
          items={dateItems}
          value={date}
          onChange={(value) => setPicked((current) => ({ ...current, date: value }))}
        />
        <MetricPicker
          id={`${ids}-interval`}
          label={t("metrics.timeline.interval")}
          items={Object.fromEntries(
            TIMELINE_INTERVALS.map((interval) => [
              interval,
              t(`metrics.timeline.intervals.${interval}`),
            ]),
          )}
          value={picked.interval}
          onChange={(value) =>
            setPicked((current) => ({ ...current, interval: value as TimelineInterval }))
          }
        />
        <MetricPicker
          id={`${ids}-measure`}
          label={t("metrics.measure")}
          items={measure.items}
          value={measure.key}
          onChange={(value) => setPicked((current) => ({ ...current, measure: value }))}
        />
      </div>

      {timeline.isPending ? (
        <Skeleton className="mt-5 h-56 rounded-lg" />
      ) : timeline.isError ? (
        <p role="alert" className="mt-5 text-sm text-destructive">
          {t("metrics.loadError")}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">{t("metrics.timeline.noDates")}</p>
      ) : (
        <figure className="mt-5">
          <div aria-hidden="true">
            <ChartContainer className="aspect-auto h-60 w-full">
              <AreaChart data={rows} margin={{ left: 4, right: 12, top: 8 }} accessibilityLayer={false}>
                <defs>
                  <linearGradient id={`${ids}-fill`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis
                  width={56}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => measure.display(value)}
                />
                <ChartTooltip content={<ChartTooltipContent title={measure.label} />} />
                <Area
                  dataKey="value"
                  type="monotone"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill={`url(#${ids}-fill)`}
                />
              </AreaChart>
            </ChartContainer>
          </div>
          <ChartData
            caption={caption}
            labelHeader={t("metrics.timeline.period")}
            valueHeader={measure.label}
            rows={rows}
          />
          <figcaption className="mt-2 text-xs text-muted-foreground">{caption}</figcaption>
        </figure>
      )}
    </ChartCard>
  );
}
