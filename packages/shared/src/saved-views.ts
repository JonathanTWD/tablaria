import { z } from "zod";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  recordFilterSchema,
  SEARCH_MAX_LENGTH,
  SORT_ORDERS,
} from "./records.js";

/** A table's saved views: search, filters, sort and grouping with a name (ADR-041). */
export const MAX_SAVED_VIEWS_PER_TABLE = 20;
export const SAVED_VIEW_NAME_MAX_LENGTH = 60;

/** What a saved view stores: the records view of the URL, without the page. */
export const savedViewQuerySchema = z.object({
  search: z.string().trim().max(SEARCH_MAX_LENGTH).default(""),
  sort: z.uuid().optional(),
  order: z.enum(SORT_ORDERS).default("asc"),
  filters: z.array(recordFilterSchema).max(50).default([]),
  group: z.uuid().optional(),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type SavedViewQuery = z.infer<typeof savedViewQuerySchema>;

const savedViewNameSchema = z.string().trim().min(1).max(SAVED_VIEW_NAME_MAX_LENGTH);

export const savedViewInputSchema = z.object({
  name: savedViewNameSchema,
  view: savedViewQuerySchema,
});

export type SavedViewInput = z.infer<typeof savedViewInputSchema>;

/** Rename a view, or save the table's current view over it. */
export const savedViewUpdateSchema = z
  .object({ name: savedViewNameSchema, view: savedViewQuerySchema })
  .partial()
  .refine((update) => update.name !== undefined || update.view !== undefined, "Nothing to change");

export type SavedViewUpdate = z.infer<typeof savedViewUpdateSchema>;

export interface SavedView {
  id: string;
  name: string;
  view: SavedViewQuery;
  /** Who saved it: the part of the email before the @; null for demo or deleted accounts. */
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
