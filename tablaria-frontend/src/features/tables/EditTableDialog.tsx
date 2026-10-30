import { zodResolver } from "@hookform/resolvers/zod";
import {
  TABLE_DESCRIPTION_MAX_LENGTH,
  tableNameSchema,
  type TableDetail,
} from "@tablaria/shared";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
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
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/error-message";
import { useUpdateTable } from "./queries";

const editTableSchema = z.object({
  name: tableNameSchema,
  description: z.string().trim().max(TABLE_DESCRIPTION_MAX_LENGTH),
});

type EditTableForm = z.infer<typeof editTableSchema>;

interface EditTableDialogProps {
  table: TableDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTableDialog({ table, open, onOpenChange }: EditTableDialogProps) {
  const { t } = useTranslation(["tables", "common"]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("common:close")} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("edit.title")}</DialogTitle>
          <DialogDescription className="sr-only">{table.name}</DialogDescription>
        </DialogHeader>
        <EditTableForm table={table} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EditTableForm({ table, onDone }: { table: TableDetail; onDone: () => void }) {
  const { t } = useTranslation("tables");
  const ids = useId();
  const update = useUpdateTable(table.id);
  const form = useForm<EditTableForm>({
    resolver: zodResolver(editTableSchema),
    mode: "onTouched",
    defaultValues: { name: table.name, description: table.description ?? "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    update.mutate(values, {
      onSuccess: () => {
        toast.success(t("edit.saved"));
        onDone();
      },
    }),
  );

  return (
    <form noValidate onSubmit={onSubmit}>
      <FieldGroup className="gap-5">
        {update.error && <FormAlert>{apiErrorMessage(update.error)}</FormAlert>}
        <FormField
          id={`${ids}-name`}
          label={t("edit.name")}
          error={errors.name && t("validation.tableName")}
        >
          <Input autoComplete="off" className="h-9" {...form.register("name")} />
        </FormField>
        <FormField
          id={`${ids}-description`}
          label={t("edit.description")}
          description={t("edit.descriptionHint")}
          error={errors.description && t("validation.description")}
        >
          <Textarea rows={3} {...form.register("description")} />
        </FormField>
      </FieldGroup>
      <DialogFooter className="mt-6">
        <DialogClose render={<Button type="button" variant="outline" className="h-9" />}>
          {t("cancel")}
        </DialogClose>
        <SubmitButton pending={update.isPending} className="h-9 w-full text-sm sm:w-auto">
          {t("edit.submit")}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
