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
  /** Every record below a threshold, across all the user's tables. */
  total: number;
  /** The most urgent ones (lowest values first). */
  items: StockAlert[];
}

export const STOCK_ALERTS_LIMIT = 8;
