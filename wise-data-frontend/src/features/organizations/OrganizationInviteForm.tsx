import { zodResolver } from "@hookform/resolvers/zod";
import {
  INVITABLE_ORGANIZATION_ROLES,
  organizationInviteSchema,
  type OrganizationInviteInput,
} from "@wisedata/shared";
import { Mail } from "lucide-react";
import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
import { SubmitButton } from "@/components/form/SubmitButton";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/features/auth/session";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { useInviteToOrganization } from "./queries";
import { useRoleLabels } from "./role-labels";

const INVITE_ERRORS = {
  409: "invite.errors.alreadyMember",
  422: "invite.errors.limit",
  429: "invite.errors.tooMany",
  403: "invite.errors.demo",
} as const;

/** The API's reasons to refuse an invitation, worded for this form. */
function inviteErrorKey(error: Error) {
  return error instanceof ApiError && error.status in INVITE_ERRORS
    ? INVITE_ERRORS[error.status as keyof typeof INVITE_ERRORS]
    : null;
}

export function OrganizationInviteForm({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation("organizations");
  const ids = useId();
  const { data: user } = useSession();
  const invite = useInviteToOrganization(organizationId);
  const roleLabels = useRoleLabels();
  const form = useForm<OrganizationInviteInput>({
    resolver: zodResolver(organizationInviteSchema),
    mode: "onTouched",
    defaultValues: { email: "", role: "EDITOR" },
  });
  const { errors } = form.formState;

  // The public demo can't send email to anyone; the API refuses it too.
  if (user?.demoExpiresAt) {
    return <FormAlert>{t("invite.errors.demo")}</FormAlert>;
  }

  const errorKey = invite.error && inviteErrorKey(invite.error);
  const inviteError = invite.error && (errorKey ? t(errorKey) : apiErrorMessage(invite.error));

  const onSubmit = form.handleSubmit((values) =>
    invite.mutate(values, {
      onSuccess: (invitation) => {
        toast.success(t("invite.invited", { email: invitation.email }));
        // Ready for the next person, with the same role.
        form.setValue("email", "", { shouldTouch: false, shouldDirty: false });
      },
    }),
  );

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3">
      {inviteError && <FormAlert>{inviteError}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <FormField
          id={`${ids}-email`}
          label={t("invite.email")}
          error={errors.email && t("invite.errors.email")}
        >
          <Input
            type="email"
            autoComplete="off"
            placeholder="nombre@empresa.com"
            className="h-9"
            {...form.register("email")}
          />
        </FormField>
        <Field>
          <FieldLabel htmlFor={`${ids}-role`}>{t("invite.role")}</FieldLabel>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select
                items={roleLabels}
                value={field.value}
                onValueChange={(value) => value && field.onChange(value)}
              >
                <SelectTrigger id={`${ids}-role`} className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITABLE_ORGANIZATION_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{t("rolesHint")}</p>
      <SubmitButton pending={invite.isPending} className="h-9 w-full text-sm sm:w-fit">
        <Mail aria-hidden="true" />
        {t("invite.submit")}
      </SubmitButton>
    </form>
  );
}
