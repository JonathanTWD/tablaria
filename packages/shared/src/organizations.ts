import { z } from "zod";
import { emailSchema } from "./auth.js";
import type { PendingInvitation, TableRole } from "./sharing.js";

export const ORGANIZATION_NAME_MAX_LENGTH = 80;
export const MAX_ORGANIZATIONS_PER_USER = 10;
/** Members plus pending invitations. */
export const MAX_MEMBERS_PER_ORGANIZATION = 25;
export const MAX_PENDING_INVITATIONS_PER_ORGANIZATION = 20;

export const organizationNameSchema = z.string().trim().min(1).max(ORGANIZATION_NAME_MAX_LENGTH);

export const organizationInputSchema = z.object({ name: organizationNameSchema });
export type OrganizationInput = z.input<typeof organizationInputSchema>;

/** Owners are made by promotion, never invited directly. */
export const INVITABLE_ORGANIZATION_ROLES = ["VIEWER", "EDITOR", "ADMIN"] as const;

export const organizationInviteSchema = z.object({
  email: emailSchema,
  role: z.enum(INVITABLE_ORGANIZATION_ROLES),
});
export type OrganizationInviteInput = z.input<typeof organizationInviteSchema>;

export const updateMemberSchema = z.object({
  role: z.enum(["VIEWER", "EDITOR", "ADMIN", "OWNER"]),
});
export type UpdateMemberInput = z.input<typeof updateMemberSchema>;

export interface OrganizationSummary {
  id: string;
  name: string;
  /** The user's own space; it can't be renamed, deleted or shared. */
  personal: boolean;
  /** The current user's role. */
  role: TableRole;
  memberCount: number;
  tableCount: number;
  createdAt: string;
}

export interface OrganizationMember {
  userId: string;
  email: string;
  role: TableRole;
  createdAt: string;
}

export interface OrganizationDetail extends OrganizationSummary {
  members: OrganizationMember[];
  /** Empty for members who can't manage the organization. */
  invitations: PendingInvitation[];
}
