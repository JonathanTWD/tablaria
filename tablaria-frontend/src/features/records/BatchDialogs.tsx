import { recordDataSchema, type TableColumn } from "@tablaria/shared";
import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { FormAlert } from "@/components/form/FormAlert";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import i18n from "@/i18n";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage, repeatedValues } from "@/lib/error-message";
import { fromDraft } from "./cell-draft";
import { ColumnValueInput } from "./ColumnValueInput";
import { useDeleteRecords, useUpdateRecords } from "./queries";

function batchErrorMessage(error: unknown): string {
  if (repeatedValues(error).length > 0) {
    return i18n.t("records:batch.duplicate");
  }
  if (error instanceof ApiError && error.status === 404) {
    return i18n.t("records:batch.gone");
  }
  return apiErrorMessage(error);
}

/** Gives one column the same value in every selected record. Rendered only while open. */
export function BatchEditDialog({
  tableId,
  columns,
  ids,
  linked,
  onDone,
  onOpenChange,
}: {
  tableId: string;
  /** Columns a person fills: computed ones are left out by the caller. */
  columns: TableColumn[];
  ids: string[];
  linked?: Record<string, string>;
  /** After the change went through. */
  onDone: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation(["records", "common"]);
  const fieldIds = useId();
  // One value in several records would repeat it: unique columns are left out.
  const editable = columns.filter((column) => !column.unique || ids.length === 1);
  const [columnId, setColumnId] = useState(editable[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const update = useUpdateRecords(tableId);
  const column = editable.find(({ id }) => id === columnId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!column) {
      return;
    }
    const value = fromDraft(column, draft);
    const checked = recordDataSchema([column], { partial: true }).safeParse({ [column.id]: value });
    if (!checked.success || (column.required && value === null)) {
      setInvalid(true);
      return;
    }
    update.mutate(
      { ids, changes: checked.data },
      {
        onSuccess: ({ count }) => {
          toast.success(t("batch.edited", { count }));
          onDone();
        },
      },
    );
  };

  const message =
    invalid && column
      ? column.required && fromDraft(column, draft) === null
        ? t("dialog.errors.required")
        : t(`dialog.errors.${column.type}`)
      : undefined;
  const errorId = `${fieldIds}-error`;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("common:close")} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("batch.editTitle", { count: ids.length })}</DialogTitle>
          <DialogDescription>{t("batch.editDescription")}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit}>
          <FieldGroup className="gap-4">
            {update.error && <FormAlert>{batchErrorMessage(update.error)}</FormAlert>}
            {editable.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("batch.nothingEditable")}</p>
            )}
            {editable.length > 0 && (
            <Field>
              <FieldLabel htmlFor={`${fieldIds}-column`}>{t("batch.column")}</FieldLabel>
              <Select
                items={Object.fromEntries(editable.map(({ id, name }) => [id, name]))}
                value={columnId}
                onValueChange={(next) => {
                  setColumnId(next ?? "");
                  setDraft("");
                  setInvalid(false);
                }}
              >
                <SelectTrigger id={`${fieldIds}-column`} className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editable.map(({ id, name }) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            )}
            {column && (
              <Field data-invalid={Boolean(message)}>
                <FieldLabel htmlFor={`${fieldIds}-value`}>{t("batch.value")}</FieldLabel>
                <ColumnValueInput
                  // A new field for each column, so a draft never carries over.
                  key={column.id}
                  id={`${fieldIds}-value`}
                  column={column}
                  value={draft}
                  onChange={(next) => {
                    setDraft(next);
                    setInvalid(false);
                  }}
                  invalid={Boolean(message)}
                  describedBy={message ? errorId : `${fieldIds}-hint`}
                  linked={linked}
                />
                {message ? (
                  <FieldError id={errorId}>{message}</FieldError>
                ) : (
                  <p id={`${fieldIds}-hint`} className="text-sm text-muted-foreground">
                    {t("batch.emptyHint")}
                  </p>
                )}
              </Field>
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <DialogClose render={<Button type="button" variant="outline" className="h-9" />}>
              {t("cancel")}
            </DialogClose>
            {column && (
              <SubmitButton pending={update.isPending} className="h-9 w-full text-sm sm:w-auto">
                {t("batch.editSubmit", { count: ids.length })}
              </SubmitButton>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Deletes every selected record after confirming. Rendered only while open. */
export function BatchDeleteDialog({
  tableId,
  ids,
  onDone,
  onOpenChange,
}: {
  tableId: string;
  ids: string[];
  onDone: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("records");
  const remove = useDeleteRecords(tableId);
  return (
    <ConfirmDeleteDialog
      title={t("batch.deleteTitle", { count: ids.length })}
      description={t("batch.deleteDescription")}
      confirmLabel={t("batch.deleteSubmit", { count: ids.length })}
      pending={remove.isPending}
      error={remove.error && batchErrorMessage(remove.error)}
      onConfirm={() =>
        remove.mutate(ids, {
          onSuccess: ({ count }) => {
            toast.success(t("batch.deleted", { count }));
            onDone();
          },
        })
      }
      onOpenChange={onOpenChange}
    />
  );
}
