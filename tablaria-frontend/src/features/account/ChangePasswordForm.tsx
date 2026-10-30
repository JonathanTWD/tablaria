import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { changePasswordSchema, type ChangePasswordInput } from "@tablaria/shared";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
import { SubmitButton } from "@/components/form/SubmitButton";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { passwordErrorMessage } from "@/features/auth/field-errors";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { accountApi } from "./api";

/** Other browsers lose their session; this one gets a new one from the API. */
export function ChangePasswordForm() {
  const { t } = useTranslation(["app", "auth"]);
  const ids = useId();
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onTouched",
    defaultValues: { currentPassword: "", newPassword: "" },
  });
  const { errors } = form.formState;
  const change = useMutation({
    mutationFn: accountApi.changePassword,
    onSuccess: () => {
      toast.success(t("settings.password.changed"));
      form.reset();
    },
  });

  const error =
    change.error &&
    (change.error instanceof ApiError && change.error.status === 422
      ? t("settings.password.wrong")
      : apiErrorMessage(change.error));

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => change.mutate(values))}
      className="flex max-w-md flex-col gap-4"
    >
      {error && <FormAlert>{error}</FormAlert>}
      <FormField
        id={`${ids}-current`}
        label={t("settings.password.current")}
        error={passwordErrorMessage(errors.currentPassword, { required: true })}
      >
        <PasswordInput autoComplete="current-password" {...form.register("currentPassword")} />
      </FormField>
      <FormField
        id={`${ids}-new`}
        label={t("auth:fields.newPassword")}
        description={t("auth:fields.passwordHint")}
        error={passwordErrorMessage(errors.newPassword)}
      >
        <PasswordInput autoComplete="new-password" {...form.register("newPassword")} />
      </FormField>
      <SubmitButton pending={change.isPending} className="h-10 w-full text-sm sm:w-fit">
        {t("settings.password.submit")}
      </SubmitButton>
    </form>
  );
}
