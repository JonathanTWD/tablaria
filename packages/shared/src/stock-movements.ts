import { z } from "zod";

/** What a person records by hand: goods in, goods out, or a recount (ADR-024). */
export const STOCK_ENTRY_KINDS = ["in", "out", "count"] as const;
/** Edits of the cell and imports that change it are kept too. */
export const STOCK_MOVEMENT_KINDS = [...STOCK_ENTRY_KINDS, "edit", "import"] as const;
export type StockMovementKind = (typeof STOCK_MOVEMENT_KINDS)[number];

export const STOCK_NOTE_MAX_LENGTH = 200;
export const MAX_STOCK_QUANTITY = 1_000_000_000;
/** Movements a record's history returns, newest first. */
export const STOCK_HISTORY_LIMIT = 100;

export const stockEntrySchema = z
  .object({
    columnId: z.uuid(),
    kind: z.enum(STOCK_ENTRY_KINDS),
    /** Units in or out, or the units counted. */
    quantity: z.number().min(0).max(MAX_STOCK_QUANTITY),
    note: z
      .string()
      .trim()
      .max(STOCK_NOTE_MAX_LENGTH)
      .nullable()
      .default(null)
      .transform((note) => (note === "" ? null : note)),
  })
  .refine(({ kind, quantity }) => kind === "count" || quantity > 0, {
    path: ["quantity"],
    message: "Goods in or out need a quantity",
  });
export type StockEntryInput = z.input<typeof stockEntrySchema>;
export type StockEntry = z.output<typeof stockEntrySchema>;

export const stockHistoryQuerySchema = z.object({ columnId: z.uuid().optional() });
export type StockHistoryQuery = z.infer<typeof stockHistoryQuerySchema>;

export interface StockMovement {
  id: string;
  recordId: string;
  columnId: string;
  kind: StockMovementKind;
  /** Units it added (negative: removed). */
  delta: number;
  /** The stock right after it. */
  balance: number;
  note: string | null;
  /** Who made it: the part of their email before the @; null for demo or deleted accounts. */
  by: string | null;
  createdAt: string;
}

export interface StockHistory {
  /** The newest STOCK_HISTORY_LIMIT movements. */
  data: StockMovement[];
  total: number;
}
