import { z } from "zod";

/** Questions a day for each account, and for each demo session (ADR-042). */
export const ASSISTANT_DAILY_LIMIT = 15;
export const ASSISTANT_DEMO_LIMIT = 5;
/** The latest messages sent with each question: older ones are left out. */
export const ASSISTANT_MAX_MESSAGES = 6;
export const ASSISTANT_MESSAGE_MAX_LENGTH = 1000;

export const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(ASSISTANT_MESSAGE_MAX_LENGTH),
});

export type AssistantMessage = z.infer<typeof assistantMessageSchema>;

export const assistantChatSchema = z.object({
  /** The conversation so far, ending with the user's question. */
  messages: z
    .array(assistantMessageSchema)
    .min(1)
    .max(ASSISTANT_MAX_MESSAGES)
    .refine((messages) => messages.at(-1)?.role === "user", "The last message must be a question"),
  /** The table the user has open, where the assistant starts looking. */
  tableId: z.uuid().optional(),
});

export type AssistantChat = z.infer<typeof assistantChatSchema>;

/** A table or record an answer was based on, to link to it. */
export interface AssistantSource {
  tableId: string;
  tableName: string;
  /** Absent when the source is a whole table. */
  recordId?: string;
  label: string;
}

export interface AssistantReply {
  message: string;
  sources: AssistantSource[];
  /** Questions left today. */
  remaining: number;
}

export interface AssistantStatus {
  /** False when the API has no model configured: the assistant isn't offered. */
  enabled: boolean;
  limit: number;
  remaining: number;
}
