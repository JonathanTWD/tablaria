import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { loginSchema } from "@wisedata/shared";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authApi } from "@/features/auth/api";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { SubmitButton } from "@/components/form/SubmitButton";
import { emailErrorMessage, passwordErrorMessage } from "@/features/auth/field-errors";
import { isInvitationPath } from "@/features/auth/redirect";
import { useStartSession } from "@/features/auth/session";
import { TryDemoButton } from "@/features/auth/TryDemoButton";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage, genericErrorMessage } from "@/lib/error-message";

type LoginForm = z.input<typeof loginSchema>;

export default function LoginPage() {
  const { t } = useTranslation("auth");
  const [searchParams] = useSearchParams();
  const startSession = useStartSession();
  const form = useForm<LoginForm, unknown, z.output<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  // GuestOnly redirects to `?redirect=` (or /app) as soon as the session is stored.
  const login = useMutation({ mutationFn: authApi.login, onSuccess: startSession });
  const resend = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => toast.success(t("resend.sent")),
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const notVerified = login.error instanceof ApiError && login.error.status === 403;
  const loginError = (() => {
    if (!login.error || notVerified) return null;
    if (login.error instanceof ApiError && login.error.status === 401) {
      return t("login.invalidCredentials");
    }
    return genericErrorMessage(login.error) ?? t("login.invalidCredentials");
  })();

  return (
    <>
      <AuthHeading title={t("login.title")} description={t("login.description")} />

      {isInvitationPath(searchParams.get("redirect")) && (
        <p className="mb-6 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm leading-6">
          {t("login.invitationHint")}{" "}
          <Link
            to={{ pathname: "/register", search: searchParams.toString() }}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("login.invitationRegister")}
          </Link>
        </p>
      )}

      <form noValidate onSubmit={form.handleSubmit((values) => login.mutate(values))}>
        <FieldGroup className="gap-5">
          {loginError && <FormAlert>{loginError}</FormAlert>}
          {notVerified && (
            <FormAlert>
              <span className="block">{t("login.notVerified")}</span>
              <Button
                type="button"
                variant="link"
                className="mt-1 h-auto p-0"
                disabled={resend.isPending}
                onClick={() => resend.mutate({ email: form.getValues("email") })}
              >
                {t("login.resend")}
              </Button>
            </FormAlert>
          )}

          <FormField
            id="email"
            label={t("fields.email")}
            error={emailErrorMessage(errors.email)}
          >
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
            error={passwordErrorMessage(errors.password, { required: true })}
          >
            <PasswordInput autoComplete="current-password" {...form.register("password")} />
          </FormField>

          <div className="-mt-2 text-right text-sm">
            <Link
              to="/forgot-password"
              className="inline-block py-1 font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("login.forgot")}
            </Link>
          </div>

          <SubmitButton pending={login.isPending}>{t("login.submit")}</SubmitButton>
        </FieldGroup>
      </form>

      <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {t("login.or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{t("login.demoHint")}</p>
      <TryDemoButton variant="outline" className="mt-3 h-11 w-full text-[0.95rem]" />

      <p className="mt-8 text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <Link
          to={{ pathname: "/register", search: searchParams.toString() }}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("login.register")}
        </Link>
      </p>
    </>
  );
}
