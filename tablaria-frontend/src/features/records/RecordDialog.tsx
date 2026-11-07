import {
  recordDataSchema,
  type RecordData,
  type TableColumn,
  type TableRecord,
} from "@tablaria/shared";
import { useId } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage, repeatedValues } from "@/lib/error-message";
import { fromDraft, toDraft } from "./cell-draft";
import { ColumnValueInput } from "./ColumnValueInput";
import { useCreateRecord, useUpdateRecord } from "./queries";

/** One text draft per column id. */
type RecordForm = Record<string, string>;

interface RecordDialogProps {
  tableId: string;
  columns: TableColumn[];
  /** The record to edit; omitted to create one. */
  record?: TableRecord;
  /** Names of other people editing a cell of this record right now. */
  editingBy?: string[];
  /** Labels of the records relation cells link to (ADR-022). */
  linked?: Record<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecordDialog({ open, onOpenChange, record, ...props }: RecordDialogProps) {
  const { t } = useTranslation(["records", "common"]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("common:close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{record ? t("dialog.editTitle") : t("dialog.createTitle")}</DialogTitle>
          <DialogDescription>{t("dialog.description")}</DialogDescription>
        </DialogHeader>
        {/* The popup unmounts when closed, so every opening starts from fresh values. */}
        <RecordForm record={record} onDone={() => onOpenChange(false)} {...props} />
      </DialogContent>
    </Dialog>
  );
}

function RecordForm({
  tableId,
  columns,
  record,
  editingBy = [],
  linked = {},
  onDone,
}: Omit<RecordDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const { t } = useTranslation("records");
  const ids = useId();
  const create = useCreateRecord(tableId);
  const update = useUpdateRecord(tableId);
  const mutation = record ? update : create;

  // Same rules as the API. Every column is sent, so defaults only fill new records.
  const resolver: Resolver<RecordForm, unknown, RecordData> = (values) => {
    const data = Object.fromEntries(
      columns.map((column) => [column.id, fromDraft(column, values[column.id] ?? "")]),
    );
    const result = recordDataSchema(columns, { partial: false }).safeParse(data);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    return {
      values: {},
      errors: Object.fromEntries(
        result.error.issues.map((issue) => [
          String(issue.path[0]),
          { type: issue.message === "Required" ? "required" : "invalid", message: issue.message },
        ]),
      ),
    };
  };

  const form = useForm<RecordForm, unknown, RecordData>({
    resolver,
    mode: "onTouched",
    defaultValues: Object.fromEntries(
      columns.map((column) => [
        column.id,
        toDraft(record ? record.data[column.id] : column.defaultValue),
      ]),
    ),
  });

  // Read at the top level: the React Compiler memoizes JSX by the values it reads.
  const { errors, dirtyFields } = form.formState;

  const onSubmit = form.handleSubmit((data) => {
    const onSuccess = () => {
      toast.success(record ? t("dialog.saved") : t("dialog.created"));
      onDone();
    };
    // A unique column refused the value: point at its field.
    const onError = (error: Error) => {
      for (const { path } of repeatedValues(error)) {
        form.setError(path, { type: "duplicate" }, { shouldFocus: true });
      }
    };
    if (record) {
      // Only what this person changed: sending every field would undo what
      // others saved on the same record while the dialog was open.
      const changes = Object.fromEntries(
        Object.entries(data).filter(([columnId]) => dirtyFields[columnId]),
      );
      if (Object.keys(changes).length === 0) {
        onDone();
        return;
      }
      update.mutate({ recordId: record.id, changes }, { onSuccess, onError });
    } else {
      create.mutate(data, { onSuccess, onError });
    }
  });

  const formError =
    repeatedValues(mutation.error).length > 0
      ? null
      : mutation.error instanceof ApiError && mutation.error.status === 422
        ? t("dialog.limit")
        : mutation.error instanceof ApiError && mutation.error.status === 400
          ? t("dialog.changedColumns")
          : mutation.error && apiErrorMessage(mutation.error);

  return (
    <form noValidate onSubmit={onSubmit}>
      <FieldGroup className="gap-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        {editingBy.length > 0 && (
          <p
            role="status"
            className="rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100"
          >
            {t("dialog.othersEditing", { names: editingBy.join(", "), count: editingBy.length })}
          </p>
        )}
        {columns.map((column) => {
          const id = `${ids}-${column.id}`;
          const error = errors[column.id];
          const message =
            error &&
            (error.type === "required"
              ? t("dialog.errors.required")
              : error.type === "duplicate"
                ? t("dialog.errors.duplicate")
                : t(`dialog.errors.${column.type}`));
          const label = `${column.name}${column.type === "currency" ? ` (${column.options.currency})` : ""}${column.required ? " *" : ""}`;
          const describedBy = message ? `${id}-error` : undefined;

          return (
            <Field key={column.id} data-invalid={Boolean(message)}>
              <FieldLabel htmlFor={id}>{label}</FieldLabel>
              <Controller
                control={form.control}
                name={column.id}
                render={({ field }) => (
                  <ColumnValueInput
                    ref={field.ref}
                    id={id}
                    column={column}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={Boolean(message)}
                    describedBy={describedBy}
                    linked={linked}
                  />
                )}
              />
              {message && <FieldError id={describedBy}>{message}</FieldError>}
            </Field>
          );
        })}
      </FieldGroup>

      <DialogFooter className="mt-6">
        <DialogClose render={<Button type="button" variant="outline" className="h-9" />}>
          {t("cancel")}
        </DialogClose>
        <SubmitButton pending={mutation.isPending} className="h-9 w-full text-sm sm:w-auto">
          {record ? t("dialog.editSubmit") : t("dialog.createSubmit")}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
