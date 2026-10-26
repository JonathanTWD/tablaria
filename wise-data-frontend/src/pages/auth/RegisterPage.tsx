import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { registerSchema } from "@wisedata/shared";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { z } from "zod";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authApi } from "@/features/auth/api";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { CheckEmail } from "@/features/auth/components/CheckEmail";
import { FormAlert } from "@/features/auth/components/FormAlert";
import { FormField } from "@/features/auth/components/FormField";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { SubmitButton } from "@/features/auth/components/SubmitButton";
import { emailErrorMessage, passwordErrorMessage } from "@/features/auth/field-errors";
import { apiErrorMessage } from "@/lib/error-message";

type RegisterForm = z.input<typeof registerSchema>;

export default function RegisterPage() {
  const { t } = useTranslation("auth");
  const form = useForm<RegisterForm, unknown, z.output<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;
  const register = useMutation({ mutationFn: authApi.register });

  if (register.isSuccess) {
    return (
      <CheckEmail
        email={register.variables.email}
        onUseAnother={() => {
          register.reset();
          form.reset();
        }}
      />
    );
  }

  return (
    <>
      <AuthHeading title={t("register.title")} description={t("register.description")} />

      <form noValidate onSubmit={form.handleSubmit((values) => register.mutate(values))}>
        <FieldGroup className="gap-5">
          {register.error && (
            <FormAlert>
              {apiErrorMessage(register.error)}
            </FormAlert>
          )}

          <FormField id="email" label={t("fields.email")} error={emailErrorMessage(errors.email)}>
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              className="h-10"
              {...form.register("email")}
            />
          </FormField>

          <FormField
            id="password"
            label={t("fields.password")}
            description={t("fields.passwordHint")}
            error={passwordErrorMessage(errors.password)}
          >
            <PasswordInput autoComplete="new-password" {...form.register("password")} />
          </FormField>

          <SubmitButton pending={register.isPending}>{t("register.submit")}</SubmitButton>
        </FieldGroup>
      </form>

      <p className="mt-8 text-sm text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("register.login")}
        </Link>
      </p>
    </>
  );
}
