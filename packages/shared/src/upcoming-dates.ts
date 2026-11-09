import { z } from "zod";
import { isoDaySchema } from "./column-types.js";

/** A record whose date comes within its column's warning (ADR-048). */
export interface UpcomingDate {
  tableId: string;
  tableName: string;
  recordId: string;
  /** The record's first cell, which usually names it (e.g. the order). */
  label: string | null;
  columnName: string;
  /** ISO day ("2026-11-12"). */
  date: string;
  /** 0 is today. */
  daysLeft: number;
}

export interface UpcomingDates {
  /** Every date coming within its warning, across all the user's tables (or the one asked for). */
  total: number;
  /** The nearest ones first. */
  items: UpcomingDate[];
}

export const UPCOMING_DATES_LIMIT = 8;

export const upcomingDatesQuerySchema = z.object({
  /** The viewer's today: dates have no time zone, so the browser says which day it is. */
  today: isoDaySchema,
  /** Only the dates of this table, as its metrics show them. */
  tableId: z.uuid().optional(),
});

export type UpcomingDatesQuery = z.output<typeof upcomingDatesQuerySchema>;
