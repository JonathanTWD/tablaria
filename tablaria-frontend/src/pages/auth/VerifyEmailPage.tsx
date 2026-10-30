import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { verifyEmailSchema } from "@tablaria/shared";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import type { z } from "zod";
import { FieldGroup } from "@/components/ui/field";
import { authApi } from "@/features/auth/api";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { ResendVerificationForm } from "@/features/auth/components/ResendVerificationForm";
import { SubmitButton } from "@/components/form/SubmitButton";
import { passwordErrorMessage } from "@/features/auth/field-errors";
import { takeAfterSignup } from "@/features/auth/redirect";
import { useStartSession } from "@/features/auth/session";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";

// The token comes from the URL, so the form only edits the password.
const passwordOnlySchema = verifyEmailSchema.pick({ password: true });
type PasswordForm = z.input<typeof passwordOnlySchema>;

export default function VerifyEmailPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const token = useSearchParams()[0].get("token");
  const startSession = useStartSession();
  const form = useForm<PasswordForm, unknown, z.output<typeof passwordOnlySchema>>({
    resolver: zodResolver(passwordOnlySchema),
    mode: "onTouched",
    defaultValues: { password: "" },
  });

  const verify = useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: (user) => {
      startSession(user);
      toast.success(t("verify.success"));
      // An invitation that led to signing up is accepted next.
      navigate(takeAfterSignup(), { replace: true });
    },
  });

  const linkInvalid =
    !token || (verify.error instanceof ApiError && verify.error.status === 400);

  if (linkInvalid) {
    return (
      <>
        <AuthHeading
          title={t("invalidLink.title")}
          description={t("invalidLink.verifyDescription")}
        />
        <ResendVerificationForm />
      </>
    );
  }

  return (
    <>
      <AuthHeading title={t("verify.title")} description={t("verify.description")} />
      <form
        noValidate
        onSubmit={form.handleSubmit(({ password }) => verify.mutate({ token, password }))}
      >
        <FieldGroup className="gap-5">
          {verify.error && (
            <FormAlert>
              {apiErrorMessage(verify.error)}
            </FormAlert>
          )}
          <FormField
            id="password"
            label={t("fields.password")}
            description={t("fields.passwordHint")}
            error={passwordErrorMessage(form.formState.errors.password)}
          >
            <PasswordInput autoComplete="new-password" {...form.register("password")} />
          </FormField>
          <SubmitButton pending={verify.isPending}>{t("verify.submit")}</SubmitButton>
        </FieldGroup>
      </form>
    </>
  );
}
