import { zodResolver } from "@hookform/resolvers/zod";
import {
  organizationInputSchema,
  type OrganizationDetail,
  type OrganizationInput,
} from "@tablaria/shared";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
import { SubmitButton } from "@/components/form/SubmitButton";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/error-message";
import { useRenameOrganization } from "./queries";

export function RenameOrganizationForm({ organization }: { organization: OrganizationDetail }) {
  const { t } = useTranslation("organizations");
  const ids = useId();
  const rename = useRenameOrganization(organization.id);
  const form = useForm<OrganizationInput>({
    resolver: zodResolver(organizationInputSchema),
    mode: "onTouched",
    values: { name: organization.name },
  });

  const onSubmit = form.handleSubmit((values) =>
    rename.mutate(values, { onSuccess: () => toast.success(t("rename.saved")) }),
  );

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3">
      {rename.error && <FormAlert>{apiErrorMessage(rename.error)}</FormAlert>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <FormField
            id={`${ids}-name`}
            label={t("rename.title")}
            error={form.formState.errors.name && t("rename.error")}
          >
            <Input autoComplete="organization" className="h-9" {...form.register("name")} />
          </FormField>
        </div>
        <SubmitButton pending={rename.isPending} className="h-9 w-full text-sm sm:w-auto">
          {t("rename.submit")}
        </SubmitButton>
      </div>
    </form>
  );
}
