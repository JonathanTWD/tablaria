export const DEFAULT_AUTHENTICATED_PATH = "/app";

/**
 * Only internal paths are accepted as a post-login destination, so a crafted
 * `?redirect=https://evil.example` (or `//evil.example`) cannot send users away.
 */
export function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  return target;
}

/** Invitation links send people without a session through login or sign-up. */
export function isInvitationPath(path: string | null): path is string {
  return path?.startsWith("/invitations?") ?? false;
}

const AFTER_SIGNUP_KEY = "wisedata:after-signup";

/**
 * Remembers where to go once the new account is confirmed. The confirmation
 * link may open in another tab, so it's kept in localStorage, not in the URL.
 */
export function rememberAfterSignup(path: string) {
  try {
    localStorage.setItem(AFTER_SIGNUP_KEY, path);
  } catch {
    // Storage blocked: after confirming, the app opens at its usual start.
  }
}

/** The remembered destination, once: reading it forgets it. */
export function takeAfterSignup(): string {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(AFTER_SIGNUP_KEY);
    localStorage.removeItem(AFTER_SIGNUP_KEY);
  } catch {
    // Storage blocked: nothing was remembered.
  }
  return safeRedirect(saved);
}
