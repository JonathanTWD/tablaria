import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { registerSchema } from "@tablaria/shared";
import { useForm } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import type { z } from "zod";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authApi } from "@/features/auth/api";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { CheckEmail } from "@/features/auth/components/CheckEmail";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { SubmitButton } from "@/components/form/SubmitButton";
import { emailErrorMessage, passwordErrorMessage } from "@/features/auth/field-errors";
import { isInvitationPath, rememberAfterSignup } from "@/features/auth/redirect";
import { apiErrorMessage } from "@/lib/error-message";

const TERMS_LINK_CLASS = "font-medium text-primary underline underline-offset-4 hover:decoration-2";

type RegisterForm = z.input<typeof registerSchema>;

export default function RegisterPage() {
  const { t } = useTranslation("auth");
  const form = useForm<RegisterForm, unknown, z.output<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");
  const invited = isInvitationPath(redirect);
  const register = useMutation({
    mutationFn: authApi.register,
    // Confirming the account then leads straight to the invitation.
    onSuccess: () => invited && rememberAfterSignup(redirect),
  });

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

      {invited && (
        <p className="mb-6 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm leading-6">
          {t("register.invitationHint")}
        </p>
      )}

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
              className="h-11"
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
          <p className="text-sm text-muted-foreground">
            <Trans
              t={t}
              i18nKey="register.terms"
              components={{
                legal: <Link to="/aviso-legal" className={TERMS_LINK_CLASS} />,
                privacy: <Link to="/privacidad" className={TERMS_LINK_CLASS} />,
              }}
            />
          </p>
        </FieldGroup>
      </form>

      <p className="mt-8 text-sm text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <Link
          to={{ pathname: "/login", search: searchParams.toString() }}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("register.login")}
        </Link>
      </p>
    </>
  );
}
