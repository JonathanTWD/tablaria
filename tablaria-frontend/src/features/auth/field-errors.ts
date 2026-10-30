import type { FieldError } from "react-hook-form";
import i18n from "@/i18n";

// Zod issue codes arrive as `error.type` through the resolver.
export function emailErrorMessage(error: FieldError | undefined) {
  return error ? i18n.t("validation.email") : undefined;
}

/** `required` is for login, where only an empty field is a client-side error. */
export function passwordErrorMessage(
  error: FieldError | undefined,
  { required = false }: { required?: boolean } = {},
) {
  if (!error) {
    return undefined;
  }
  if (error.type === "too_big") {
    return i18n.t("validation.passwordMax");
  }
  return required
    ? i18n.t("validation.passwordRequired")
    : i18n.t("validation.passwordMin");
}
