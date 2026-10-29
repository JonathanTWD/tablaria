import { z } from "zod";
import { PASSWORD_MAX_LENGTH, passwordSchema } from "./auth.js";
import type { ColumnType } from "./column-types.js";
import type { TableRole } from "./sharing.js";

/** The current password, checked but not held to today's policy. */
const currentPasswordSchema = z.string().min(1).max(PASSWORD_MAX_LENGTH);

export const changePasswordSchema = z.object({
  currentPassword: currentPasswordSchema,
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({ password: currentPasswordSchema });
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/**
 * Everything the user put into WiseData, readable without it (RGPD,
 * portability): the account, where they have access, and the tables of their
 * personal space with records keyed by column name.
 */
export interface AccountExport {
  exportedAt: string;
  account: { email: string; createdAt: string };
  organizations: { name: string; role: TableRole }[];
  sharedWithMe: { table: string; role: TableRole }[];
  tables: {
    name: string;
    description: string | null;
    columns: { name: string; type: ColumnType; required: boolean }[];
    records: Record<string, string | number | boolean | null>[];
  }[];
}
