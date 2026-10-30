import {
  MAX_STOCK_QUANTITY,
  STOCK_ENTRY_KINDS,
  STOCK_NOTE_MAX_LENGTH,
  type StockEntryInput,
} from "@wisedata/shared";
import { z } from "zod";

export type StockEntryKind = (typeof STOCK_ENTRY_KINDS)[number];

/** What the movement form edits: the quantity as typed. */
export interface StockEntryForm {
  kind: StockEntryKind;
  quantity: string;
  note: string;
}

/** Units typed with a decimal comma or point; NaN when it isn't a number. */
export function parseQuantity(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? Number.NaN : Number(trimmed.replace(",", "."));
}

/** Same rules as the API: a positive quantity in or out; any count from 0. */
export const stockEntryFormSchema = z
  .object({
    kind: z.enum(STOCK_ENTRY_KINDS),
    quantity: z.string(),
    note: z.string().max(STOCK_NOTE_MAX_LENGTH),
  })
  .superRefine((values, ctx) => {
    const quantity = parseQuantity(values.quantity);
    const valid =
      Number.isFinite(quantity) &&
      quantity <= MAX_STOCK_QUANTITY &&
      (values.kind === "count" ? quantity >= 0 : quantity > 0);
    if (!valid) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Invalid quantity" });
    }
  });

export function toStockEntry(columnId: string, values: StockEntryForm): StockEntryInput {
  return {
    columnId,
    kind: values.kind,
    quantity: parseQuantity(values.quantity),
    note: values.note.trim() || null,
  };
}

/** The stock a movement would leave, for the preview under the quantity. */
export function stockAfter(current: number, kind: StockEntryKind, quantity: number): number {
  return kind === "in" ? current + quantity : kind === "out" ? current - quantity : quantity;
}
