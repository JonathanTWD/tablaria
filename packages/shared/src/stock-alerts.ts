import { z } from "zod";

/** A record whose number is below its column's alert threshold. */
export interface StockAlert {
  tableId: string;
  tableName: string;
  recordId: string;
  /** The record's first cell, which usually names it (e.g. the product). */
  label: string | null;
  columnName: string;
  value: number;
  alertBelow: number;
}

export interface StockAlerts {
  /** Every record below a threshold, across all the user's tables (or the one asked for). */
  total: number;
  /** The most urgent ones (lowest values first). */
  items: StockAlert[];
}

export const STOCK_ALERTS_LIMIT = 8;

export const stockAlertsQuerySchema = z.object({
  /** Only the alerts of this table, as its metrics show them (ADR-035). */
  tableId: z.uuid().optional(),
});

export type StockAlertsQuery = z.output<typeof stockAlertsQuerySchema>;
