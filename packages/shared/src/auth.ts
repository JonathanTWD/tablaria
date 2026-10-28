import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
// argon2 accepts long inputs, but an upper bound keeps hashing cost predictable.
export const PASSWORD_MAX_LENGTH = 128;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH);

const tokenSchema = z.string().min(1).max(256);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // Not validated against the password policy so old passwords still get a 401, not a 400.
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const emailOnlySchema = z.object({
  email: emailSchema,
});

// The password is (re)chosen when verifying: whoever controls the mailbox sets it,
// so a password set by someone else who registered the address first never survives.
export const verifyEmailSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});

export const resetPasswordSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Public representation of the authenticated user. */
export interface AuthUser {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  /** Set for demo accounts: they are deleted, with all their data, at this time. */
  demoExpiresAt: string | null;
  createdAt: string;
}

export interface MessageResponse {
  message: string;
}
