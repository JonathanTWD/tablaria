import { ATTACHMENT_MAX_BYTES, ATTACHMENT_TYPES } from "@tablaria/shared";
import i18n from "@/i18n";
import { ApiError } from "@/lib/api-client";
import { genericErrorMessage } from "@/lib/error-message";

/** Checked before uploading, to spare a request; the API checks the real bytes again. */
export function fileProblem(file: File): string | null {
  // Some systems give no type for a valid file (WebP, for one): the API then decides.
  if (file.type && !(ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
    return i18n.t("records:attachments.wrongType", { name: file.name });
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return i18n.t("records:attachments.tooLarge", { name: file.name });
  }
  return null;
}

export function uploadErrorMessage(error: unknown, name: string): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 413:
        return i18n.t("records:attachments.tooLarge", { name });
      case 415:
        return i18n.t("records:attachments.wrongType", { name });
      case 422:
        return error.body?.message === "Storage quota reached"
          ? i18n.t("records:attachments.quota")
          : i18n.t("records:attachments.limit");
      case 403:
        return error.body?.message === "Not available in the demo"
          ? i18n.t("records:attachments.demo")
          : i18n.t("records:attachments.forbidden");
      case 503:
        return i18n.t("records:attachments.unavailable");
    }
  }
  return genericErrorMessage(error) ?? i18n.t("errors.unexpected");
}

/** "820 KB", "2,4 MB". */
export function formatSize(bytes: number, locale: string): string {
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.max(1, kilobytes))} KB`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(kilobytes / 1024)} MB`;
}
