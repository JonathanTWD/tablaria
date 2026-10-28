import { z } from "zod";
import type { ColumnType } from "./column-types.js";

/** Columns whose values make meaningful groups: few distinct values per table. */
export const STATS_GROUP_TYPES = ["select", "boolean", "text"] as const satisfies ColumnType[];
/** Columns that can be added up within each group. */
export const STATS_SUM_TYPES = ["number", "currency"] as const satisfies ColumnType[];

/** Groups shown one by one; the rest are added up together. */
export const STATS_MAX_GROUPS = 8;

export const recordStatsQuerySchema = z.object({
  groupBy: z.uuid(),
  /** Without it, groups are measured by their number of records. */
  sum: z.uuid().optional(),
});

export type RecordStatsQuery = z.output<typeof recordStatsQuerySchema>;

export interface StatsGroup {
  /** The cell value shared by the group; null for records with it empty. */
  value: string | boolean | null;
  count: number;
  /** Sum of the `sum` column, null when no record in the group has a value. */
  sum: number | null;
}

export interface RecordStats {
  /** Records in the table. */
  total: number;
  /** The largest groups first, at most `STATS_MAX_GROUPS`. */
  groups: StatsGroup[];
  /** Every other group added up, or null when all fit. */
  others: { groupCount: number; count: number; sum: number | null } | null;
}
