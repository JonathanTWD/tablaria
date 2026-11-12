import { useQuery } from "@tanstack/react-query";
import type { MetricGroup, TableDetail } from "@tablaria/shared";
import { ChartBar, ChartPie } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useCellFormatter } from "@/features/columns/format-value";
import { cn } from "@/lib/utils";
import { ChartData, type ChartRow } from "./ChartData";
import { MetricPicker } from "./MetricPicker";
import { COUNT, useMeasure } from "./measure";
import { defaultGroupBy, groupableColumns, selectColor } from "./metric-columns";
import { metricGroupsQuery } from "./queries";

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-2)"];
const EMPTY_FILL = "var(--color-zinc-400)";

type View = "bars" | "donut";

/** The table's records split by a column: counted, added up or compared. */
export function GroupsChart({ table }: { table: TableDetail }) {
  const { t } = useTranslation("records");
  const ids = useId();
  const format = useCellFormatter();
  const [picked, setPicked] = useState<{ groupBy?: string; measure: string; view: View }>({
    measure: COUNT,
    view: "bars",
  });

  const groupable = groupableColumns(table.columns);
  const groupBy =
    groupable.find(({ id }) => id === picked.groupBy) ?? defaultGroupBy(table.columns);
  const measure = useMeasure(table.columns, picked.measure);
  // Parts of a whole only make sense for counts and sums.
  const canDonut = measure.measure === null || measure.measure.fn === "sum";
  const view = canDonut ? picked.view : "bars";
  const groups = useQuery({
    ...metricGroupsQuery(table.id, {
      groupBy: groupBy?.id ?? "",
      column: measure.measure?.column.id,
      fn: measure.measure?.fn ?? "sum",
    }),
    enabled: groupBy !== undefined,
  });

  if (!groupBy) {
    return (
      <ChartCard title={t("metrics.groups.title")}>
        <p className="text-sm text-muted-foreground">{t("metrics.groups.noGroupable")}</p>
      </ChartCard>
    );
  }

  const fillOf = (group: MetricGroup, index: number): string => {
    if (group.value === null) {
      return EMPTY_FILL;
    }
    if (groupBy.type === "boolean") {
      return selectColor(group.value ? "green" : "gray");
    }
    if (groupBy.type === "select") {
      const choice = groupBy.options.choices.find(({ label }) => label === group.value);
      if (choice) {
        return selectColor(choice.color);
      }
    }
    return view === "donut" ? PALETTE[index % PALETTE.length] : "var(--chart-1)";
  };
  const labelOf = (group: MetricGroup): string => {
    if (group.value === null) {
      return t("metrics.empty");
    }
    if (groupBy.type === "relation") {
      // A record of a table the user can't open is never named (ADR-028).
      return groups.data?.labels[String(group.value)] ?? t("relation.hidden");
    }
    return format(groupBy, group.value);
  };
  const toRow = (group: MetricGroup, index: number): ChartRow => {
    const value = measure.measure ? group.measure : group.count;
    return {
      key: JSON.stringify(group.value),
      label: labelOf(group),
      value: value ?? 0,
      display: value === null ? "—" : measure.display(value),
      fill: fillOf(group, index),
    };
  };
  const rows = (groups.data?.groups ?? []).map(toRow);
  const others = groups.data?.others;
  if (others) {
    const value = measure.measure ? others.measure : others.count;
    rows.push({
      key: "others",
      label: t("metrics.others", { count: others.groupCount }),
      value: value ?? 0,
      display: value === null ? "—" : measure.display(value),
      fill: EMPTY_FILL,
    });
  }
  const caption = t("metrics.groups.caption", { measure: measure.label, group: groupBy.name });

  return (
    <ChartCard
      title={t("metrics.groups.title")}
      actions={
        canDonut && (
          <div role="group" aria-label={t("metrics.groups.view")} className="flex gap-1">
            {(["bars", "donut"] as const).map((option) => {
              const Icon = option === "bars" ? ChartBar : ChartPie;
              return (
                <Button
                  key={option}
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t(`metrics.groups.${option}`)}
                  aria-pressed={view === option}
                  onClick={() => setPicked((current) => ({ ...current, view: option }))}
                  className={cn("size-8", view === option && "bg-muted text-foreground")}
                >
                  <Icon aria-hidden="true" />
                </Button>
              );
            })}
          </div>
        )
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricPicker
          id={`${ids}-group`}
          label={t("metrics.groups.groupBy")}
          items={Object.fromEntries(groupable.map(({ id, name }) => [id, name]))}
          value={groupBy.id}
          onChange={(value) => setPicked((current) => ({ ...current, groupBy: value }))}
        />
        <MetricPicker
          id={`${ids}-measure`}
          label={t("metrics.measure")}
          items={measure.items}
          value={measure.key}
          onChange={(value) => setPicked((current) => ({ ...current, measure: value }))}
        />
      </div>

      {groups.isPending ? (
        <Skeleton className="mt-5 h-56 rounded-lg" />
      ) : groups.isError ? (
        <p role="alert" className="mt-5 text-sm text-destructive">
          {t("metrics.loadError")}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">{t("metrics.noRecords")}</p>
      ) : (
        <figure className="mt-5">
          <div aria-hidden="true">
            {view === "bars" ? (
              <ChartContainer
                className="aspect-auto w-full"
                style={{ height: rows.length * 36 + 16 }}
              >
                <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 16 }} accessibilityLayer={false}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={112}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(label: string) =>
                      label.length > 16 ? `${label.slice(0, 15)}…` : label
                    }
                  />
                  <ChartTooltip content={<ChartTooltipContent title={measure.label} />} />
                  <Bar dataKey="value" radius={4} barSize={20}>
                    {rows.map((row) => (
                      <Cell key={row.key} fill={row.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <ChartContainer className="aspect-square max-h-60 w-full">
                  <PieChart accessibilityLayer={false}>
                    <ChartTooltip content={<ChartTooltipContent title={measure.label} />} />
                    <Pie data={rows} dataKey="value" nameKey="label" innerRadius="55%" strokeWidth={2}>
                      {rows.map((row) => (
                        <Cell key={row.key} fill={row.fill} className="stroke-card" />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <ul className="grid gap-1.5 text-sm">
                  {rows.map((row) => (
                    <li key={row.key} className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: row.fill }} />
                      <span className="min-w-0 flex-1 truncate">{row.label}</span>
                      <span className="tabular-nums text-muted-foreground">{row.display}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <ChartData
            caption={caption}
            labelHeader={groupBy.name}
            valueHeader={measure.label}
            rows={rows}
          />
          <figcaption className="mt-2 text-xs text-muted-foreground">{caption}</figcaption>
        </figure>
      )}
    </ChartCard>
  );
}

/** The frame every metrics chart sits in. */
export function ChartCard({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={titleId} className="font-semibold tracking-tight">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
