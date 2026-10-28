import { z } from "zod";
import { emailSchema } from "./auth.js";
import type { TableSummary } from "./tables.js";

/** Roles a user can have in a table, lowest first (ADR-019). */
export const TABLE_ROLES = ["VIEWER", "EDITOR", "ADMIN", "OWNER"] as const;
export type TableRole = (typeof TABLE_ROLES)[number];

/** Sharing a single table never grants more than editing its records. */
export const SHARE_ROLES = ["VIEWER", "EDITOR"] as const;
export type ShareRole = (typeof SHARE_ROLES)[number];

/** People with access plus pending invitations, per table. */
export const MAX_PEOPLE_PER_TABLE = 25;
export const MAX_PENDING_INVITATIONS_PER_TABLE = 20;
export const INVITATION_TTL_DAYS = 7;

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(SHARE_ROLES),
});
export type InviteInput = z.input<typeof inviteSchema>;

export const updateShareSchema = z.object({ role: z.enum(SHARE_ROLES) });
export type UpdateShareInput = z.input<typeof updateShareSchema>;

export const invitationTokenSchema = z.object({ token: z.string().min(1).max(200) });
export type InvitationTokenInput = z.input<typeof invitationTokenSchema>;

export interface TableShareMember {
  userId: string;
  email: string;
  role: ShareRole;
  createdAt: string;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: ShareRole;
  expiresAt: string;
  createdAt: string;
}

export interface TableSharing {
  members: TableShareMember[];
  invitations: PendingInvitation[];
}

/** What the invitation page shows before accepting. */
export interface InvitationPreview {
  tableName: string;
  /** Email of the person who invited, or null if their account is gone. */
  invitedBy: string | null;
  role: ShareRole;
  /** The invited address; accepting needs an account with this email. */
  email: string;
  expiresAt: string;
}

export interface AcceptedInvitation {
  tableId: string;
}

/** A table someone else shared with the user. */
export interface SharedTableSummary extends TableSummary {
  /** Whose table it is: the owner's email, or the organization's name. */
  sharedBy: string;
}
