import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  STOCK_HISTORY_LIMIT,
  STOCK_NOTE_MAX_LENGTH,
  type StockMovement,
  type StockMovementKind,
  type TableColumn,
  type TableRecord,
} from "@wisedata/shared";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  FileUp,
  type LucideIcon,
  Pencil,
} from "lucide-react";
import { useId, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
import { SubmitButton } from "@/components/form/SubmitButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { type CellFormatter, useCellFormatter } from "@/features/columns/format-value";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { stockHistoryQuery, useRecordStockEntry } from "./queries";
import {
  parseQuantity,
  type StockEntryForm,
  stockAfter,
  stockEntryFormSchema,
  toStockEntry,
} from "./stock-entry";

const KIND_ICONS: Record<StockMovementKind, LucideIcon> = {
  in: ArrowDownToLine,
  out: ArrowUpFromLine,
  count: ClipboardCheck,
  edit: Pencil,
  import: FileUp,
};

interface StockDialogProps {
  tableId: string;
  record: TableRecord;
  /** The record's name, for the title. */
  label: string;
  /** The table's stock columns; at least one. */
  columns: TableColumn[];
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A record's stock: goods in, goods out or a recount, and its history (ADR-024). */
export function StockDialog({ label, canEdit, onOpenChange, ...props }: StockDialogProps) {
  const { t } = useTranslation(["records", "common"]);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("common:close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{t("stock.title", { label })}</DialogTitle>
          <DialogDescription>
            {canEdit ? t("stock.description") : t("stock.descriptionReadOnly")}
          </DialogDescription>
        </DialogHeader>
        <StockPanel canEdit={canEdit} {...props} />
      </DialogContent>
    </Dialog>
  );
}

function StockPanel({
  tableId,
  record,
  columns,
  canEdit,
}: Omit<StockDialogProps, "label" | "onOpenChange">) {
  const { t } = useTranslation("records");
  const ids = useId();
  const format = useCellFormatter();
  const [columnId, setColumnId] = useState(columns[0].id);
  const column = columns.find(({ id }) => id === columnId) ?? columns[0];
  const value = record.data[column.id];
  const current = typeof value === "number" ? value : 0;

  return (
    <div className="flex flex-col gap-5">
      {columns.length > 1 && (
        <Field>
          <FieldLabel htmlFor={`${ids}-column`}>{t("stock.column")}</FieldLabel>
          <Select
            items={Object.fromEntries(columns.map(({ id, name }) => [id, name]))}
            value={column.id}
            onValueChange={(next) => next && setColumnId(next)}
          >
            <SelectTrigger id={`${ids}-column`} className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {columns.map(({ id, name }) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <p className="flex items-baseline justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
        <span className="text-sm text-muted-foreground">{t("stock.current", { column: column.name })}</span>
        <span className="text-xl font-semibold tabular-nums">{format(column, current)}</span>
      </p>
      {canEdit && (
        // A new form per column: what was typed belongs to the column it was typed for.
        <StockEntryFields
          key={column.id}
          tableId={tableId}
          recordId={record.id}
          column={column}
          current={current}
          format={format}
        />
      )}
      <StockHistoryList tableId={tableId} recordId={record.id} column={column} format={format} />
    </div>
  );
}

function StockEntryFields({
  tableId,
  recordId,
  column,
  current,
  format,
}: {
  tableId: string;
  recordId: string;
  column: TableColumn;
  current: number;
  format: CellFormatter;
}) {
  const { t } = useTranslation("records");
  const ids = useId();
  const entry = useRecordStockEntry(tableId, recordId);
  const form = useForm<StockEntryForm>({
    resolver: zodResolver(stockEntryFormSchema),
    mode: "onTouched",
    defaultValues: { kind: "in", quantity: "", note: "" },
  });
  const [kind, quantityText] = useWatch({ control: form.control, name: ["kind", "quantity"] });
  const { errors } = form.formState;
  const quantity = parseQuantity(quantityText);
  const after = Number.isFinite(quantity) ? stockAfter(current, kind, quantity) : null;

  const onSubmit = form.handleSubmit((values) => {
    entry.mutate(toStockEntry(column.id, values), {
      onSuccess: ({ movement }) => {
        toast.success(t("stock.saved", { value: format(column, movement.balance) }));
        form.reset({ kind: values.kind, quantity: "", note: "" });
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 422) {
          form.setError("quantity", { type: "notEnough" }, { shouldFocus: true });
        }
      },
    });
  });

  const quantityError =
    errors.quantity &&
    (errors.quantity.type === "notEnough"
      ? t("stock.errors.notEnough", { value: format(column, current) })
      : t(kind === "count" ? "stock.errors.count" : "stock.errors.quantity"));
  const formError =
    entry.error && !(entry.error instanceof ApiError && entry.error.status === 422)
      ? apiErrorMessage(entry.error)
      : null;

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {formError && <FormAlert>{formError}</FormAlert>}
      <FieldSet className="gap-2">
        <FieldLegend variant="label">{t("stock.kind")}</FieldLegend>
        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => (
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1">
              {(["in", "out", "count"] as const).map((option) => {
                const Icon = KIND_ICONS[option];
                return (
                  <label
                    key={option}
                    className={cn(
                      "flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors motion-reduce:transition-none",
                      "hover:bg-muted hover:text-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      "has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={option}
                      checked={field.value === option}
                      onChange={() => field.onChange(option)}
                      onBlur={field.onBlur}
                      className="sr-only"
                    />
                    <Icon aria-hidden="true" className="size-4" />
                    {t(`stock.kinds.${option}`)}
                  </label>
                );
              })}
            </div>
          )}
        />
      </FieldSet>
      {/* Controlled: the Base UI input keeps its own value, which a reset must reach. */}
      <Controller
        control={form.control}
        name="quantity"
        render={({ field }) => (
          <FormField
            id={`${ids}-quantity`}
            label={t(`stock.quantity.${kind}`)}
            error={quantityError || undefined}
            description={
              after === null
                ? kind === "count"
                  ? t("stock.countHint")
                  : undefined
                : after < 0
                  ? t("stock.errors.notEnough", { value: format(column, current) })
                  : t("stock.after", { value: format(column, after) })
            }
          >
            <Input inputMode="decimal" autoComplete="off" className="h-9" {...field} />
          </FormField>
        )}
      />
      <Controller
        control={form.control}
        name="note"
        render={({ field }) => (
          <FormField id={`${ids}-note`} label={t("stock.note")} description={t("stock.noteHint")}>
            <Input autoComplete="off" maxLength={STOCK_NOTE_MAX_LENGTH} className="h-9" {...field} />
          </FormField>
        )}
      />
      {/* The history follows, so no footer band: the dialog closes with its X. */}
      <div className="flex justify-end">
        <SubmitButton pending={entry.isPending} className="h-9 w-full text-sm sm:w-auto">
          {t(`stock.submit.${kind}`)}
        </SubmitButton>
      </div>
    </form>
  );
}

function StockHistoryList({
  tableId,
  recordId,
  column,
  format,
}: {
  tableId: string;
  recordId: string;
  column: TableColumn;
  format: CellFormatter;
}) {
  const { t, i18n } = useTranslation("records");
  const ids = useId();
  const history = useQuery(stockHistoryQuery(tableId, recordId, column.id));
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });

  return (
    <section aria-labelledby={`${ids}-history`} className="flex flex-col gap-2">
      <h3 id={`${ids}-history`} className="text-sm font-medium">
        {t("stock.history")}
      </h3>
      {history.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : history.isError ? (
        <p className="text-sm text-muted-foreground">
          {t("stock.historyError")}{" "}
          <Button variant="link" className="h-auto p-0" onClick={() => void history.refetch()}>
            {t("retry")}
          </Button>
        </p>
      ) : history.data.total === 0 ? (
        <p className="text-sm text-muted-foreground">{t("stock.historyEmpty")}</p>
      ) : (
        <>
          <ol className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {history.data.data.map((movement) => (
              <MovementItem
                key={movement.id}
                movement={movement}
                column={column}
                format={format}
                date={date}
              />
            ))}
          </ol>
          {history.data.total > history.data.data.length && (
            <p className="text-xs text-muted-foreground">
              {t("stock.historyLimit", { count: STOCK_HISTORY_LIMIT, total: history.data.total })}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function MovementItem({
  movement,
  column,
  format,
  date,
}: {
  movement: StockMovement;
  column: TableColumn;
  format: CellFormatter;
  date: Intl.DateTimeFormat;
}) {
  const { t } = useTranslation("records");
  const Icon = KIND_ICONS[movement.kind];
  // The sign is spelled out, so the color is never the only cue.
  const delta = `${movement.delta < 0 ? "−" : "+"}${format(column, Math.abs(movement.delta))}`;

  return (
    <li className="flex items-start gap-3 px-3 py-2.5 text-sm">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t(`stock.kinds.${movement.kind}`)}</p>
        <p className="text-xs text-muted-foreground">
          <time dateTime={movement.createdAt}>{date.format(new Date(movement.createdAt))}</time>
          {movement.by && ` · ${movement.by}`}
        </p>
        {movement.note && <p className="mt-1 break-words text-muted-foreground">{movement.note}</p>}
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <p
          className={cn(
            "font-medium",
            movement.delta < 0
              ? "text-red-700 dark:text-red-400"
              : "text-emerald-700 dark:text-emerald-400",
          )}
        >
          {delta}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("stock.balance", { value: format(column, movement.balance) })}
        </p>
      </div>
    </li>
  );
}
