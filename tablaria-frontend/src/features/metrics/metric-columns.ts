import {
  canGroupMetricsBy,
  canMeasure,
  METRIC_GROUP_TYPES,
  type MetricFunction,
  type SelectColor,
  type TableColumn,
  type TimelineBucket,
  type TimelineInterval,
  TIMELINE_MAX_BUCKETS,
} from "@tablaria/shared";

/**
 * Columns worth grouping by. The first one is left out: it usually names each
 * record (product, employee…), so every group would hold a single record.
 */
export function groupableColumns(columns: TableColumn[]): TableColumn[] {
  return columns.slice(1).filter(canGroupMetricsBy);
}

export function measurableColumns(columns: TableColumn[]): TableColumn[] {
  return columns.filter(canMeasure);
}

export function dateColumns(columns: TableColumn[]): TableColumn[] {
  return columns.filter(({ type }) => type === "date");
}

/** The groupable column of the most useful type (`METRIC_GROUP_TYPES` order). */
export function defaultGroupBy(columns: TableColumn[]): TableColumn | undefined {
  const groupable = groupableColumns(columns);
  return METRIC_GROUP_TYPES.map((type) => groupable.find((column) => column.type === type)).find(
    Boolean,
  );
}

/** "count", or a function over a column: how a picker names a measure. */
export type MeasureKey = "count" | `${MetricFunction}:${string}`;

export function parseMeasure(
  key: string,
  columns: TableColumn[],
): { column: TableColumn; fn: MetricFunction } | null {
  const [fn, columnId] = key.split(":");
  const column = measurableColumns(columns).find(({ id }) => id === columnId);
  return column && ["sum", "avg", "min", "max"].includes(fn)
    ? { column, fn: fn as MetricFunction }
    : null;
}

/** A select color as a CSS color, so chart marks match the table's badges. */
export function selectColor(color: SelectColor): string {
  return `var(--color-${color === "gray" ? "zinc" : color}-500)`;
}

function addPeriod(day: Date, interval: TimelineInterval): Date {
  const next = new Date(day);
  if (interval === "month") {
    next.setUTCMonth(next.getUTCMonth() + 1);
  } else {
    next.setUTCDate(next.getUTCDate() + (interval === "week" ? 7 : 1));
  }
  return next;
}

/**
 * The periods between the first and the last bucket, the empty ones with no
 * records: a timeline shows the gaps too. Keeps the most recent ones.
 */
export function fillTimeline(
  buckets: TimelineBucket[],
  interval: TimelineInterval,
): TimelineBucket[] {
  if (buckets.length === 0) {
    return [];
  }
  const byStart = new Map(buckets.map((bucket) => [bucket.start, bucket]));
  const last = buckets[buckets.length - 1].start;
  const filled: TimelineBucket[] = [];
  for (
    let day = new Date(`${buckets[0].start}T00:00:00Z`);
    day.toISOString().slice(0, 10) <= last;
    day = addPeriod(day, interval)
  ) {
    const start = day.toISOString().slice(0, 10);
    filled.push(byStart.get(start) ?? { start, count: 0, filled: 0, measure: null });
  }
  return filled.slice(-TIMELINE_MAX_BUCKETS);
}
