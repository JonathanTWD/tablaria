import { useQuery } from "@tanstack/react-query";
import type { StatsGroup, TableColumn, TableSummary } from "@tablaria/shared";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SELECT_FILL_CLASSES } from "@/features/columns/column-ui";
import { useCellFormatter } from "@/features/columns/format-value";
import { recordStatsQuery } from "@/features/records/queries";
import { tableQuery } from "@/features/tables/queries";
import { cn } from "@/lib/utils";
import { BarChart, type BarChartRow } from "./BarChart";
import { defaultGroupBy, groupableColumns, summableColumns } from "./chart-columns";

const COUNT = "count";

function fillClassName(column: TableColumn, value: StatsGroup["value"]): string | undefined {
  if (value === null) {
    return "fill-zinc-300 dark:fill-zinc-600";
  }
  if (column.type === "boolean") {
    return value ? SELECT_FILL_CLASSES.green : SELECT_FILL_CLASSES.gray;
  }
  if (column.type === "select") {
    const choice = column.options.choices.find(({ label }) => label === value);
    return choice && SELECT_FILL_CLASSES[choice.color];
  }
  return undefined;
}

function Picker({
  id,
  label,
  items,
  value,
  onChange,
}: {
  id: string;
  label: string;
  items: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={items} value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([itemValue, text]) => (
            <SelectItem key={itemValue} value={itemValue}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** Records of one table grouped by a column, counted or added up. */
export function RecordsChart({ tables, className }: { tables: TableSummary[]; className?: string }) {
  const { t, i18n } = useTranslation("app");
  const ids = useId();
  const format = useCellFormatter();
  const [picked, setPicked] = useState<{ tableId?: string; groupBy?: string; sum?: string }>(
    {},
  );

  // Falls back to the first table with records when nothing (or a deleted table) is picked.
  const tableId =
    tables.find(({ id }) => id === picked.tableId)?.id ??
    (tables.find(({ recordCount }) => recordCount > 0) ?? tables[0]).id;
  const table = useQuery(tableQuery(tableId));
  const columns = table.data?.columns ?? [];
  const groupable = groupableColumns(columns);
  const summable = summableColumns(columns);
  const groupBy = groupable.find(({ id }) => id === picked.groupBy) ?? defaultGroupBy(columns);
  const sum = summable.find(({ id }) => id === picked.sum);
  const stats = useQuery({
    ...recordStatsQuery(tableId, { groupBy: groupBy?.id ?? "", sum: sum?.id }),
    enabled: groupBy !== undefined,
  });

  const number = new Intl.NumberFormat(i18n.language);
  const tableItems = Object.fromEntries(tables.map(({ id, name }) => [id, name]));
  const groupItems = Object.fromEntries(groupable.map(({ id, name }) => [id, name]));
  const measureItems: Record<string, string> = {
    [COUNT]: t("dashboard.charts.count"),
    ...Object.fromEntries(summable.map(({ id, name }) => [id, t("dashboard.charts.sum", { name })])),
  };
  const measure = measureItems[sum?.id ?? COUNT];
  const display = (value: number) => (sum ? format(sum, value) : number.format(value));

  const rows: BarChartRow[] = [];
  if (groupBy && stats.data) {
    for (const group of stats.data.groups) {
      const value = sum ? (group.sum ?? 0) : group.count;
      rows.push({
        // JSON keeps the text "null" apart from an empty group.
        key: JSON.stringify(group.value),
        label: group.value === null ? t("dashboard.charts.empty") : format(groupBy, group.value),
        value,
        display: display(value),
        fillClassName: fillClassName(groupBy, group.value),
      });
    }
    const { others } = stats.data;
    if (others) {
      const value = sum ? (others.sum ?? 0) : others.count;
      rows.push({
        key: "others",
        label: t("dashboard.charts.others", { count: others.groupCount }),
        value,
        display: display(value),
        fillClassName: "fill-zinc-400 dark:fill-zinc-500",
      });
    }
  }

  let body;
  if (table.isPending || (groupBy && stats.isPending)) {
    body = <Skeleton className="h-40 w-full rounded-lg" />;
  } else if (table.isError || stats.isError) {
    body = (
      <p role="status" className="text-sm text-muted-foreground">
        {t("dashboard.charts.loadError")}
      </p>
    );
  } else if (!groupBy) {
    body = <p className="text-sm text-muted-foreground">{t("dashboard.charts.noGroupable")}</p>;
  } else if (rows.length === 0) {
    body = <p className="text-sm text-muted-foreground">{t("dashboard.charts.noRecords")}</p>;
  } else {
    body = (
      <BarChart
        caption={t("dashboard.charts.caption", {
          measure,
          group: groupBy.name,
          table: tableItems[tableId],
        })}
        labelHeader={groupBy.name}
        valueHeader={measure}
        rows={rows}
      />
    );
  }

  return (
    <section aria-labelledby="chart-title" className={cn("@container/chart", className)}>
      <h2 id="chart-title" className="text-lg font-semibold tracking-tight">
        {t("dashboard.charts.title")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.charts.description")}</p>
      <div className="mt-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="grid gap-3 @xl/chart:grid-cols-3">
          <Picker
            id={`${ids}-table`}
            label={t("dashboard.charts.table")}
            items={tableItems}
            value={tableId}
            onChange={(next) => setPicked({ tableId: next })}
          />
          {groupBy && (
            <>
              <Picker
                id={`${ids}-group`}
                label={t("dashboard.charts.groupBy")}
                items={groupItems}
                value={groupBy.id}
                onChange={(next) => setPicked((current) => ({ ...current, groupBy: next }))}
              />
              <Picker
                id={`${ids}-measure`}
                label={t("dashboard.charts.measure")}
                items={measureItems}
                value={sum?.id ?? COUNT}
                onChange={(next) =>
                  setPicked((current) => ({ ...current, sum: next === COUNT ? undefined : next }))
                }
              />
            </>
          )}
        </div>
        {/* Groups of the previous choice stay visible, dimmed, until the new ones arrive. */}
        <div
          aria-busy={stats.isFetching}
          className={cn("mt-5 transition-opacity", stats.isPlaceholderData && "opacity-50")}
        >
          {body}
        </div>
      </div>
    </section>
  );
}
