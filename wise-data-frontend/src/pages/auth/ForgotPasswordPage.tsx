import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { emailOnlySchema } from "@wisedata/shared";
import { MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { z } from "zod";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authApi } from "@/features/auth/api";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
import { SubmitButton } from "@/components/form/SubmitButton";
import { emailErrorMessage } from "@/features/auth/field-errors";
import { BackToLogin } from "@/features/auth/components/BackToLogin";
import { apiErrorMessage } from "@/lib/error-message";

export default function ForgotPasswordPage() {
  const { t } = useTranslation("auth");
  const form = useForm<z.input<typeof emailOnlySchema>, unknown, z.output<typeof emailOnlySchema>>({
    resolver: zodResolver(emailOnlySchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });
  const request = useMutation({ mutationFn: authApi.forgotPassword });

  if (request.isSuccess) {
    return (
      <>
        <MailCheck aria-hidden="true" className="mb-6 size-10 text-primary" strokeWidth={1.5} />
        <AuthHeading
          title={t("forgot.sentTitle")}
          description={t("forgot.sentDescription", { email: request.variables.email })}
        />
        <BackToLogin />
      </>
    );
  }

  return (
    <>
      <AuthHeading title={t("forgot.title")} description={t("forgot.description")} />
      <form noValidate onSubmit={form.handleSubmit((values) => request.mutate(values))}>
        <FieldGroup className="gap-5">
          {request.error && (
            <FormAlert>
              {apiErrorMessage(request.error)}
            </FormAlert>
          )}
          <FormField
            id="email"
            label={t("fields.email")}
            error={emailErrorMessage(form.formState.errors.email)}
          >
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              className="h-11"
              {...form.register("email")}
            />
          </FormField>
          <SubmitButton pending={request.isPending}>{t("forgot.submit")}</SubmitButton>
        </FieldGroup>
      </form>
      <BackToLogin />
    </>
  );
}
