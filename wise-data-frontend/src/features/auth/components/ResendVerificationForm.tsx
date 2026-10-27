import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { emailOnlySchema } from "@wisedata/shared";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { z } from "zod";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/error-message";
import { authApi } from "../api";
import { emailErrorMessage } from "../field-errors";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
import { SubmitButton } from "@/components/form/SubmitButton";

export function ResendVerificationForm() {
  const { t } = useTranslation("auth");
  const form = useForm<z.input<typeof emailOnlySchema>, unknown, z.output<typeof emailOnlySchema>>({
    resolver: zodResolver(emailOnlySchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });
  const resend = useMutation({ mutationFn: authApi.resendVerification });

  if (resend.isSuccess) {
    return (
      <p role="status" className="rounded-lg bg-accent px-3 py-2.5 text-sm text-accent-foreground">
        {t("resend.sent")}
      </p>
    );
  }

  return (
    <form noValidate onSubmit={form.handleSubmit((values) => resend.mutate(values))}>
      <FieldGroup className="gap-5">
        {resend.error && (
          <FormAlert>
            {apiErrorMessage(resend.error)}
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
        <SubmitButton pending={resend.isPending}>{t("invalidLink.resendSubmit")}</SubmitButton>
      </FieldGroup>
    </form>
  );
}
