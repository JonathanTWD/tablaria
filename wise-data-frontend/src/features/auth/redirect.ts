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
