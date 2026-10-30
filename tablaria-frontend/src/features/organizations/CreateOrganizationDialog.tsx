import { zodResolver } from "@hookform/resolvers/zod";
import { organizationInputSchema, type OrganizationInput } from "@tablaria/shared";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
import { SubmitButton } from "@/components/form/SubmitButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { useCreateOrganization } from "./queries";
import { useSpace } from "./space-context";

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** On success it switches to the new organization and opens its page, to invite people. */
export function CreateOrganizationDialog({ open, onOpenChange }: CreateOrganizationDialogProps) {
  const { t } = useTranslation(["organizations", "common"]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("common:close")} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so it starts empty every time. */}
        {open && <CreateOrganizationForm onCreated={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateOrganizationForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation(["organizations", "tables"]);
  const ids = useId();
  const navigate = useNavigate();
  const { setSpaceId } = useSpace();
  const create = useCreateOrganization();
  const form = useForm<OrganizationInput>({
    resolver: zodResolver(organizationInputSchema),
    mode: "onTouched",
    defaultValues: { name: "" },
  });

  const onSubmit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (organization) => {
        toast.success(t("create.created", { name: organization.name }));
        setSpaceId(organization.id);
        void navigate(`/app/organizations/${organization.id}`);
        onCreated();
      },
    }),
  );

  const formError =
    create.error &&
    (create.error instanceof ApiError && create.error.status === 422
      ? t("create.limit")
      : apiErrorMessage(create.error));

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormField
        id={`${ids}-name`}
        label={t("create.name")}
        error={form.formState.errors.name && t("rename.error")}
      >
        <Input
          autoComplete="organization"
          placeholder={t("create.namePlaceholder")}
          className="h-9"
          {...form.register("name")}
        />
      </FormField>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" className="h-9" />}>
          {t("tables:cancel")}
        </DialogClose>
        <SubmitButton pending={create.isPending} className="h-9 w-full text-sm sm:w-auto">
          {t("create.submit")}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
