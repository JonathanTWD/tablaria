import { z } from "zod";
import type { Paginated } from "./records.js";
import type { StockMovementKind } from "./stock-movements.js";

/** What happened in a table (ADR-025). */
export const ACTIVITY_ACTIONS = [
  "record.created",
  "record.updated",
  "record.deleted",
  "records.imported",
  "column.created",
  "column.updated",
  "column.deleted",
  "stock.moved",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_PAGE_SIZE = 30;

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
export type ActivityQuery = z.infer<typeof activityQuerySchema>;

/** Extra facts of an event; which ones depends on the action. */
export interface ActivityDetails {
  /** record.updated: names of the columns that changed. */
  columns?: string[];
  /** records.imported: records added and updated. */
  created?: number;
  updated?: number;
  /** column.updated: the column's name before a rename. */
  renamedFrom?: string;
  /** stock.moved: the movement, and the stock column it changed. */
  kind?: StockMovementKind;
  delta?: number;
  column?: string;
}

export interface ActivityEvent {
  id: string;
  action: ActivityAction;
  /** Who did it: the part of their email before the @; null for demo or deleted accounts. */
  by: string | null;
  /** Done by the person reading the history. */
  mine: boolean;
  /** The record (its first column) or column it concerns, as it was then. */
  label: string | null;
  /** The record it concerns, while it exists. */
  recordId: string | null;
  details: ActivityDetails;
  createdAt: string;
}

export type ActivityPage = Paginated<ActivityEvent>;
