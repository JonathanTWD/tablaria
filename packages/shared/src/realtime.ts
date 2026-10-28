import { z } from "zod";

/** Tables one connection can listen to at once. */
export const REALTIME_MAX_SUBSCRIPTIONS = 20;

/** What changed in a table, which decides what the browser refetches. */
export const REALTIME_SCOPES = ["records", "columns", "table", "sharing", "deleted"] as const;
export type RealtimeScope = (typeof REALTIME_SCOPES)[number];

export const realtimeClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("auth"), ticket: z.string().min(1).max(200) }),
  z.object({ type: z.literal("subscribe"), tableId: z.uuid() }),
  z.object({ type: z.literal("unsubscribe"), tableId: z.uuid() }),
]);
export type RealtimeClientMessage = z.infer<typeof realtimeClientMessageSchema>;

/** Server messages say what changed, never the data itself. */
export type RealtimeServerMessage =
  | { type: "ready" }
  | { type: "subscribed"; tableId: string }
  | { type: "changed"; tableId: string; scope: RealtimeScope }
  | { type: "revoked"; tableId: string }
  | { type: "error"; tableId: string; code: "not_found" | "too_many_subscriptions" };

export interface RealtimeTicket {
  ticket: string;
  /** WebSocket URL to connect to; null means the app's own origin. */
  url: string | null;
}
