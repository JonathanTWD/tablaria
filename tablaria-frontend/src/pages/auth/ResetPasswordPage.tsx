import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { resetPasswordSchema } from "@tablaria/shared";
import { CircleCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import type { z } from "zod";
import { buttonVariants } from "@/components/ui/button-variants";
import { FieldGroup } from "@/components/ui/field";
import { authApi } from "@/features/auth/api";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { BackToLogin } from "@/features/auth/components/BackToLogin";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { SubmitButton } from "@/components/form/SubmitButton";
import { passwordErrorMessage } from "@/features/auth/field-errors";
import { useEndSession } from "@/features/auth/session";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";

const passwordOnlySchema = resetPasswordSchema.pick({ password: true });
type PasswordForm = z.input<typeof passwordOnlySchema>;

export default function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const token = useSearchParams()[0].get("token");
  const endSession = useEndSession();
  const form = useForm<PasswordForm, unknown, z.output<typeof passwordOnlySchema>>({
    resolver: zodResolver(passwordOnlySchema),
    mode: "onTouched",
    defaultValues: { password: "" },
  });

  const reset = useMutation({
    mutationFn: authApi.resetPassword,
    // The API ended every session, including this browser's if it had one.
    onSuccess: endSession,
  });

  const linkInvalid = !token || (reset.error instanceof ApiError && reset.error.status === 400);

  if (linkInvalid) {
    return (
      <>
        <AuthHeading title={t("invalidLink.title")} description={t("invalidLink.resetDescription")} />
        <Link to="/forgot-password" className={cn(buttonVariants(), "h-11 w-full")}>
          {t("invalidLink.requestReset")}
        </Link>
        <BackToLogin />
      </>
    );
  }

  if (reset.isSuccess) {
    return (
      <>
        <CircleCheck aria-hidden="true" className="mb-6 size-10 text-primary" strokeWidth={1.5} />
        <AuthHeading title={t("reset.doneTitle")} description={t("reset.doneDescription")} />
        <Link to="/login" className={cn(buttonVariants(), "h-11 w-full")}>
          {t("login.submit")}
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading title={t("reset.title")} description={t("reset.description")} />
      <form
        noValidate
        onSubmit={form.handleSubmit(({ password }) => reset.mutate({ token, password }))}
      >
        <FieldGroup className="gap-5">
          {reset.error && (
            <FormAlert>
              {apiErrorMessage(reset.error)}
            </FormAlert>
          )}
          <FormField
            id="password"
            label={t("fields.newPassword")}
            description={t("fields.passwordHint")}
            error={passwordErrorMessage(form.formState.errors.password)}
          >
            <PasswordInput autoComplete="new-password" {...form.register("password")} />
          </FormField>
          <SubmitButton pending={reset.isPending}>{t("reset.submit")}</SubmitButton>
        </FieldGroup>
      </form>
    </>
  );
}
