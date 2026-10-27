import { zodResolver } from "@hookform/resolvers/zod";
import {
  COLUMN_TYPES,
  MAX_SELECT_CHOICES,
  SELECT_COLORS,
  type ColumnType,
  type SelectColor,
  type TableColumn,
} from "@wisedata/shared";
import { Plus, TriangleAlert, X } from "lucide-react";
import { useId } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
import { SubmitButton } from "@/components/form/SubmitButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateColumn, useUpdateColumn } from "@/features/tables/queries";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import {
  columnFormDefaults,
  columnFormSchema,
  newChoice,
  toColumnDefinition,
  type ColumnFormValues,
} from "./column-form";
import { COLUMN_TYPE_ICONS, COMMON_CURRENCIES, SELECT_SWATCH_CLASSES } from "./column-ui";

interface ColumnDialogProps {
  tableId: string;
  /** The column to edit; omitted to create a new one. */
  column?: TableColumn;
  /** Records whose values a type change would convert. */
  recordCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ColumnDialog({ open, onOpenChange, column, ...props }: ColumnDialogProps) {
  const { t } = useTranslation(["tables", "common"]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("common:close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>
            {column ? t("columnForm.editTitle") : t("columnForm.createTitle")}
          </DialogTitle>
          {/* The form explains itself; an empty description keeps Base UI from warning. */}
          <DialogDescription className="sr-only">
            {column ? column.name : t("columns.description")}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from fresh values. */}
        {open && <ColumnForm column={column} onDone={() => onOpenChange(false)} {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function ColumnForm({
  tableId,
  column,
  recordCount,
  onDone,
}: Omit<ColumnDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const { t, i18n } = useTranslation("tables");
  const ids = useId();
  const form = useForm<ColumnFormValues>({
    resolver: zodResolver(columnFormSchema),
    mode: "onTouched",
    defaultValues: columnFormDefaults(column),
  });
  // `keyName` keeps React keys apart from each choice's own `id`.
  const choices = useFieldArray({ control: form.control, name: "choices", keyName: "key" });
  const create = useCreateColumn(tableId);
  const update = useUpdateColumn(tableId);
  const mutation = column ? update : create;

  const type = useWatch({ control: form.control, name: "type" });
  const choiceValues = useWatch({ control: form.control, name: "choices" });
  const { errors } = form.formState;

  const onError = (error: Error) => {
    if (error instanceof ApiError && error.status === 409) {
      form.setError("name", { type: "conflict" }, { shouldFocus: true });
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    const body = toColumnDefinition(values);
    if (column) {
      update.mutate(
        { columnId: column.id, body },
        {
          onSuccess: ({ clearedValues }) => {
            toast.success(
              clearedValues > 0
                ? t("columnForm.cleared", { count: clearedValues })
                : t("columnForm.saved"),
            );
            onDone();
          },
          onError,
        },
      );
    } else {
      create.mutate(body, {
        onSuccess: (created) => {
          toast.success(t("columnForm.created", { name: created.name }));
          onDone();
        },
        onError,
      });
    }
  });

  const formError =
    mutation.error instanceof ApiError && mutation.error.status === 409
      ? null
      : mutation.error instanceof ApiError && mutation.error.status === 422
        ? t("columnForm.limit")
        : mutation.error && apiErrorMessage(mutation.error);

  const typeItems = Object.fromEntries(
    COLUMN_TYPES.map((value) => [value, t(`types.${value}`)]),
  ) as Record<ColumnType, string>;
  const currencyNames = new Intl.DisplayNames(i18n.language, { type: "currency" });
  const currencyItems = Object.fromEntries(
    COMMON_CURRENCIES.map((code) => [code, `${code} · ${currencyNames.of(code)}`]),
  );
  const colorItems = Object.fromEntries(
    SELECT_COLORS.map((color) => [color, t(`colors.${color}`)]),
  ) as Record<SelectColor, string>;
  const choicesError = errors.choices?.root ?? errors.choices;

  return (
    <form noValidate onSubmit={onSubmit}>
      <FieldGroup className="gap-5">
        {formError && <FormAlert>{formError}</FormAlert>}

        <FormField
          id={`${ids}-name`}
          label={t("columnForm.name")}
          error={
            errors.name &&
            (errors.name.type === "conflict"
              ? t("columnForm.errors.nameTaken")
              : t("columnForm.errors.name"))
          }
        >
          <Input autoComplete="off" className="h-9" {...form.register("name")} />
        </FormField>

        <Field>
          <FieldLabel htmlFor={`${ids}-type`}>{t("columnForm.type")}</FieldLabel>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select
                items={typeItems}
                value={field.value}
                onValueChange={(value) => {
                  if (value) {
                    field.onChange(value);
                    // A default typed for the previous type means something else now.
                    form.setValue("defaultValue", "");
                  }
                }}
              >
                <SelectTrigger id={`${ids}-type`} className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLUMN_TYPES.map((value) => {
                    const Icon = COLUMN_TYPE_ICONS[value];
                    return (
                      <SelectItem key={value} value={value} className="py-1.5">
                        <Icon aria-hidden="true" className="text-muted-foreground" />
                        <span className="flex flex-col">
                          {typeItems[value]}
                          <span className="text-xs text-muted-foreground">
                            {t(`typeHints.${value}`)}
                          </span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        {column && type !== column.type && recordCount > 0 && (
          <Alert className="border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription className="text-inherit">
              {t("columnForm.typeChangeWarning")}
            </AlertDescription>
          </Alert>
        )}

        {type === "currency" && (
          <Field>
            <FieldLabel htmlFor={`${ids}-currency`}>{t("columnForm.currency")}</FieldLabel>
            <Controller
              control={form.control}
              name="currency"
              render={({ field }) => (
                <Select
                  items={{ [field.value]: field.value, ...currencyItems }}
                  value={field.value}
                  onValueChange={(value) => value && field.onChange(value)}
                >
                  <SelectTrigger id={`${ids}-currency`} className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries({ [field.value]: field.value, ...currencyItems }).map(
                      ([code, label]) => (
                        <SelectItem key={code} value={code}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        )}

        {type === "select" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t("columnForm.choices")}</legend>
            <ul className="flex flex-col gap-2">
              {choices.fields.map((choice, index) => {
                const labelError = errors.choices?.[index]?.label;
                const number = index + 1;
                return (
                  <li key={choice.key} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Controller
                        control={form.control}
                        name={`choices.${index}.color`}
                        render={({ field }) => (
                          <Select
                            items={colorItems}
                            value={field.value}
                            onValueChange={(value) => value && field.onChange(value)}
                          >
                            <SelectTrigger
                              aria-label={t("columnForm.choiceColor", { index: number })}
                              className="h-9 shrink-0"
                            >
                              <span
                                aria-hidden="true"
                                className={cn("size-3.5 rounded-full", SELECT_SWATCH_CLASSES[field.value])}
                              />
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false} align="start">
                              {SELECT_COLORS.map((color) => (
                                <SelectItem key={color} value={color}>
                                  <span
                                    aria-hidden="true"
                                    className={cn("size-3 rounded-full", SELECT_SWATCH_CLASSES[color])}
                                  />
                                  {colorItems[color]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <Input
                        aria-label={t("columnForm.choiceLabel", { index: number })}
                        aria-invalid={Boolean(labelError)}
                        aria-describedby={labelError ? `${ids}-choice-${index}-error` : undefined}
                        autoComplete="off"
                        className="h-9"
                        {...form.register(`choices.${index}.label`)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-lg"
                        aria-label={t("columnForm.removeChoice", { index: number })}
                        disabled={choices.fields.length === 1}
                        onClick={() => choices.remove(index)}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    </div>
                    {labelError && (
                      <FieldError id={`${ids}-choice-${index}-error`} className="pl-12">
                        {t("columnForm.errors.choiceLabel")}
                      </FieldError>
                    )}
                  </li>
                );
              })}
            </ul>
            {choicesError?.message && (
              <FieldError>{t("columnForm.errors.choices")}</FieldError>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-9 w-fit"
              disabled={choices.fields.length >= MAX_SELECT_CHOICES}
              onClick={() => choices.append(newChoice(choices.fields.length))}
            >
              <Plus aria-hidden="true" />
              {t("columnForm.addChoice")}
            </Button>
          </fieldset>
        )}

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={`${ids}-required`}>{t("columnForm.required")}</FieldLabel>
            <FieldDescription id={`${ids}-required-hint`}>
              {t("columnForm.requiredHint")}
            </FieldDescription>
          </FieldContent>
          <Controller
            control={form.control}
            name="required"
            render={({ field }) => (
              <Switch
                id={`${ids}-required`}
                aria-describedby={`${ids}-required-hint`}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </Field>

        <DefaultValueField
          id={`${ids}-default`}
          type={type}
          choices={choiceValues}
          form={form}
          error={errors.defaultValue ? t("columnForm.errors.defaultValue") : undefined}
        />
      </FieldGroup>

      <DialogFooter className="mt-6">
        <DialogClose render={<Button type="button" variant="outline" className="h-9" />}>
          {t("cancel")}
        </DialogClose>
        <SubmitButton pending={mutation.isPending} className="h-9 w-full text-sm sm:w-auto">
          {column ? t("columnForm.editSubmit") : t("columnForm.createSubmit")}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

function DefaultValueField({
  id,
  type,
  choices,
  form,
  error,
}: {
  id: string;
  type: ColumnType;
  choices: ColumnFormValues["choices"];
  form: ReturnType<typeof useForm<ColumnFormValues>>;
  error?: string;
}) {
  const { t } = useTranslation("tables");
  const label = t("columnForm.defaultValue");
  const hint = t("columnForm.defaultValueHint");

  if (type === "boolean" || type === "select") {
    const options: Record<string, string> =
      type === "boolean"
        ? { true: t("columns.yes"), false: t("columns.no") }
        : Object.fromEntries(
            choices.filter((choice) => choice.label.trim()).map((choice) => [choice.id, choice.label]),
          );
    const items = { "": t("columnForm.noDefault"), ...options };
    return (
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Controller
          control={form.control}
          name="defaultValue"
          render={({ field }) => (
            <Select
              items={items}
              value={field.value in items ? field.value : ""}
              onValueChange={(value) => field.onChange(value ?? "")}
            >
              <SelectTrigger
                id={id}
                aria-describedby={`${id}-hint`}
                aria-invalid={Boolean(error)}
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
          )}
        />
        {error ? <FieldError>{error}</FieldError> : <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}
      </Field>
    );
  }

  return (
    <FormField id={id} label={label} description={hint} error={error}>
      <Input
        type={type === "date" ? "date" : "text"}
        inputMode={type === "number" || type === "currency" ? "decimal" : undefined}
        autoComplete="off"
        className="h-9"
        {...form.register("defaultValue")}
      />
    </FormField>
  );
}
