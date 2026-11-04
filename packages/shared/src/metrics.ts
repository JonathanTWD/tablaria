import { z } from "zod";
import type { ColumnDefinition, ColumnType } from "./column-types.js";

/**
 * A table's metrics (ADR-035): what its numbers add up to, how its records
 * split by a column and how they spread over time.
 */

/**
 * Columns whose values make meaningful groups, best first: lists (few,
 * colored values), yes/no, single relations (by the linked record), text.
 */
export const METRIC_GROUP_TYPES = [
  "select",
  "boolean",
  "relation",
  "text",
] as const satisfies ColumnType[];
/** Columns that can be added up, averaged and compared. */
export const METRIC_VALUE_TYPES = ["number", "currency"] as const satisfies ColumnType[];

export const METRIC_FUNCTIONS = ["sum", "avg", "min", "max"] as const;
export type MetricFunction = (typeof METRIC_FUNCTIONS)[number];

/** A multiple relation isn't one value per record: it doesn't group (ADR-032). */
export function canGroupMetricsBy(column: ColumnDefinition): boolean {
  return (
    (METRIC_GROUP_TYPES as readonly ColumnType[]).includes(column.type) &&
    !(column.type === "relation" && column.options.multiple)
  );
}

export function canMeasure(column: { type: ColumnType }): boolean {
  return (METRIC_VALUE_TYPES as readonly ColumnType[]).includes(column.type);
}

// Summary -----------------------------------------------------------------

/** One number column over every record that has a value in it. */
export interface ColumnSummary {
  columnId: string;
  /** Records with a value; the others don't count in the average. */
  filled: number;
  sum: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface MetricsSummary {
  /** Records in the table. */
  total: number;
  /** Every number and currency column, in column order. */
  columns: ColumnSummary[];
}

// Groups ------------------------------------------------------------------

/** Groups shown one by one; the rest are added up together. */
export const METRICS_MAX_GROUPS = 8;

export const metricGroupsQuerySchema = z.object({
  groupBy: z.uuid(),
  /** Without it, groups are measured by their number of records. */
  column: z.uuid().optional(),
  fn: z.enum(METRIC_FUNCTIONS).default("sum"),
});

export type MetricGroupsQuery = z.output<typeof metricGroupsQuerySchema>;

export interface MetricGroup {
  /**
   * The cell value shared by the group: a choice, true/false, text or the
   * linked record's id. Null for records with it empty.
   */
  value: string | boolean | null;
  count: number;
  /** Records of the group with a value in the measured column. */
  filled: number;
  /** The function over the measured column; null without values or column. */
  measure: number | null;
}

export interface MetricGroups {
  /** Records in the table. */
  total: number;
  /** The largest groups first, at most `METRICS_MAX_GROUPS`. */
  groups: MetricGroup[];
  /** Every other group put together, or null when all fit. */
  others: (Omit<MetricGroup, "value"> & { groupCount: number }) | null;
  /** Grouped by a relation: the label of each linked record the user can see. */
  labels: Record<string, string>;
}

// Timeline ----------------------------------------------------------------

export const TIMELINE_INTERVALS = ["day", "week", "month"] as const;
export type TimelineInterval = (typeof TIMELINE_INTERVALS)[number];

/** The `date` of a timeline that follows when records were created. */
export const CREATED_AT = "createdAt";

/** The most recent periods a timeline returns. */
export const TIMELINE_MAX_BUCKETS = 36;

export const timelineQuerySchema = z.object({
  /** A date column, or `createdAt`. */
  date: z.union([z.literal(CREATED_AT), z.uuid()]).default(CREATED_AT),
  interval: z.enum(TIMELINE_INTERVALS).default("month"),
  column: z.uuid().optional(),
  fn: z.enum(METRIC_FUNCTIONS).default("sum"),
});

export type TimelineQuery = z.output<typeof timelineQuerySchema>;

export interface TimelineBucket {
  /** First day of the period (weeks start on Monday), as an ISO date. */
  start: string;
  count: number;
  filled: number;
  measure: number | null;
}

/** Periods with records, oldest first; those without records are left out. */
export interface Timeline {
  buckets: TimelineBucket[];
}
