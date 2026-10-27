import {
  recordDataSchema,
  type RecordData,
  type TableColumn,
  type TableRecord,
} from "@wisedata/shared";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { fromDraft, toDraft } from "./cell-draft";
import { useCreateRecord, useUpdateRecord } from "./queries";

/** One text draft per column id. */
type RecordForm = Record<string, string>;

interface RecordDialogProps {
  tableId: string;
  columns: TableColumn[];
  /** The record to edit; omitted to create one. */
  record?: TableRecord;
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
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((data) => {
    const onSuccess = () => {
      toast.success(record ? t("dialog.saved") : t("dialog.created"));
      onDone();
    };
    if (record) {
      update.mutate({ recordId: record.id, changes: data }, { onSuccess });
    } else {
      create.mutate(data, { onSuccess });
    }
  });

  const formError =
    mutation.error instanceof ApiError && mutation.error.status === 422
      ? t("dialog.limit")
      : mutation.error instanceof ApiError && mutation.error.status === 400
        ? t("dialog.changedColumns")
        : mutation.error && apiErrorMessage(mutation.error);

  return (
    <form noValidate onSubmit={onSubmit}>
      <FieldGroup className="gap-4">
        {formError && <FormAlert>{formError}</FormAlert>}
        {columns.map((column) => {
          const id = `${ids}-${column.id}`;
          const error = errors[column.id];
          const message =
            error &&
            (error.type === "required" ? t("dialog.errors.required") : t(`dialog.errors.${column.type}`));
          const label = `${column.name}${column.type === "currency" ? ` (${column.options.currency})` : ""}${column.required ? " *" : ""}`;
          const describedBy = message ? `${id}-error` : undefined;

          return (
            <Field key={column.id} data-invalid={Boolean(message)}>
              <FieldLabel htmlFor={id}>{label}</FieldLabel>
              {column.type === "boolean" || column.type === "select" ? (
                <Controller
                  control={form.control}
                  name={column.id}
                  render={({ field }) => {
                    const options: Record<string, string> =
                      column.type === "boolean"
                        ? { true: t("filters.yes"), false: t("filters.no") }
                        : Object.fromEntries(
                            column.options.choices.map((choice) => [choice.label, choice.label]),
                          );
                    const items = { "": t("dialog.empty"), ...options };
                    return (
                      <Select
                        items={items}
                        value={field.value}
                        onValueChange={(value) => field.onChange(value ?? "")}
                      >
                        <SelectTrigger
                          id={id}
                          aria-invalid={Boolean(message)}
                          aria-describedby={describedBy}
                          onBlur={field.onBlur}
                          className="h-9 w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(items).map(([value, text]) => (
                            <SelectItem key={value} value={value}>
                              {text}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }}
                />
              ) : (
                <Input
                  id={id}
                  type={column.type === "date" ? "date" : "text"}
                  inputMode={column.type === "text" || column.type === "date" ? undefined : "decimal"}
                  autoComplete="off"
                  aria-invalid={Boolean(message)}
                  aria-describedby={describedBy}
                  className="h-9"
                  {...form.register(column.id)}
                />
              )}
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
