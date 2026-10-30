import type { ApiErrorDetail } from "@wisedata/shared";
import i18n from "@/i18n";
import { ApiError } from "./api-client";

/**
 * Message for failures every screen handles the same way (network, rate limit,
 * server errors). Returns null when the caller should explain the error itself.
 */
export function genericErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return i18n.t("errors.network");
  }
  if (error.status === 429) {
    return i18n.t("errors.tooManyRequests");
  }
  if (error.status >= 500) {
    return i18n.t("errors.unexpected");
  }
  return null;
}

/**
 * Values a unique column refused (ADR-023): `path` is the column id and
 * `message` the value. Empty for any other error.
 */
export function repeatedValues(error: unknown): ApiErrorDetail[] {
  return error instanceof ApiError && error.status === 409 ? (error.body?.details ?? []) : [];
}

/** Generic message, falling back to "unexpected" for errors the screen does not single out. */
export function apiErrorMessage(error: unknown): string {
  return genericErrorMessage(error) ?? i18n.t("errors.unexpected");
}
