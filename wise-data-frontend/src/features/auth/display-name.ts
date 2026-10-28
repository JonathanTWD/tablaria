import type { AuthUser } from "@wisedata/shared";
import i18n from "@/i18n";

/** How the UI names the user: demo accounts have a made-up address. */
export function displayName(user: AuthUser): string {
  return user.demoExpiresAt ? i18n.t("demo.name") : user.email.split("@")[0];
}

/** What the UI shows as the account's email. */
export function displayEmail(user: AuthUser): string {
  return user.demoExpiresAt ? i18n.t("demo.account") : user.email;
}
