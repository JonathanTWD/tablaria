import {
  cellValueSchema,
  type PresenceCell,
  stockLevel,
  type CellValue,
  type StockLevel,
  type TableColumn,
} from "@wisedata/shared";
import { CircleAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SELECT_CHIP_CLASSES } from "@/features/columns/column-ui";
import type { CellFormatter } from "@/features/columns/format-value";
import { cn } from "@/lib/utils";
import { fromDraft, toDraft } from "./cell-draft";

interface EditableCellProps {
  column: TableColumn;
  value: CellValue | undefined;
  /** Accessible name of the cell's control, e.g. "Precio de Taladro". */
  label: string;
  format: CellFormatter;
  onSave: (value: CellValue) => void;
  /** Lets the others see this cell is being edited (realtime presence). */
  presence?: { recordId: string; setEditing: (cell: PresenceCell | null) => void };
  /** Someone else has this cell open: editing is allowed, with a warning. */
  editedBy?: string;
}

/**
 * Announces the open cell to the others and withdraws it when it closes.
 * Presence lives on the server, an external system, which is what effects are for.
 */
function useAnnounceEditing(
  open: boolean,
  presence: EditableCellProps["presence"],
  columnId: string,
) {
  const recordId = presence?.recordId;
  const setEditing = presence?.setEditing;
  useEffect(() => {
    if (!open || !recordId || !setEditing) {
      return;
    }
    setEditing({ recordId, columnId });
    return () => setEditing(null);
  }, [open, recordId, setEditing, columnId]);
}

const numeric = (column: TableColumn) => column.type === "number" || column.type === "currency";

const STOCK_ALERTS: Record<Exclude<StockLevel, "ok">, { icon: LucideIcon; className: string }> = {
  low: { icon: TriangleAlert, className: "font-medium text-amber-700 dark:text-amber-400" },
  out: { icon: CircleAlert, className: "font-medium text-destructive" },
};

/**
 * A cell edited in place. Booleans and selects save on change; other types
 * open a field: Enter or leaving it saves, Escape cancels.
 */
export function EditableCell(props: EditableCellProps) {
  if (props.column.type === "boolean") {
    return <BooleanCell {...props} />;
  }
  if (props.column.type === "select") {
    return <SelectCell {...props} />;
  }
  return <TextualCell {...props} />;
}

function BooleanCell({ value, label, onSave }: EditableCellProps) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={value === true}
      onChange={(event) => onSave(event.target.checked)}
      className="size-4 cursor-pointer accent-primary"
    />
  );
}

function SelectCell({ column, value, label, onSave, presence }: EditableCellProps) {
  const { t } = useTranslation("records");
  const [open, setOpen] = useState(false);
  useAnnounceEditing(open, presence, column.id);
  if (column.type !== "select") {
    return null;
  }
  const choice = column.options.choices.find((item) => item.label === value);
  const items: Record<string, string> = {
    ...(column.required ? {} : { "": t("dialog.empty") }),
    ...Object.fromEntries(column.options.choices.map((item) => [item.label, item.label])),
  };

  return (
    <Select
      items={items}
      open={open}
      onOpenChange={setOpen}
      value={typeof value === "string" ? value : ""}
      onValueChange={(next) => {
        if (next !== null && next !== (value ?? "")) {
          onSave(next === "" ? null : next);
        }
      }}
    >
      <SelectTrigger
        aria-label={label}
        size="sm"
        className="h-7 w-full min-w-28 border-transparent bg-transparent px-1.5 hover:border-input dark:bg-transparent"
      >
        {choice ? (
          <span
            className={cn(
              "truncate rounded-md px-1.5 py-0.5 text-xs",
              SELECT_CHIP_CLASSES[choice.color],
            )}
          >
            {choice.label}
          </span>
        ) : (
          <SelectValue className="text-muted-foreground" />
        )}
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
        {Object.entries(items).map(([itemValue, text]) => (
          <SelectItem key={itemValue} value={itemValue}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TextualCell({
  column,
  value,
  label,
  format,
  onSave,
  presence,
  editedBy,
}: EditableCellProps) {
  const { t } = useTranslation("records");
  const [draft, setDraft] = useState<string | null>(null);
  useAnnounceEditing(draft !== null, presence, column.id);
  const [invalid, setInvalid] = useState(false);
  // Set when editing ends from the keyboard, so focus returns to the cell button.
  const returnFocus = useRef(false);

  const stop = (fromKeyboard: boolean) => {
    returnFocus.current = fromKeyboard;
    setDraft(null);
    setInvalid(false);
  };

  const commit = (fromKeyboard: boolean) => {
    if (draft === null) {
      return;
    }
    const result = cellValueSchema(column).safeParse(fromDraft(column, draft));
    const next = result.success ? result.data : undefined;
    if (next === undefined || (next === null && column.required)) {
      if (fromKeyboard) {
        // Keep the field open so the user can fix the value.
        setInvalid(true);
        return;
      }
      toast.error(t("cell.invalid", { column: column.name }));
    } else if (next !== (value ?? null)) {
      onSave(next);
    }
    stop(fromKeyboard);
  };

  if (draft !== null) {
    return (
      <>
        <input
          type={column.type === "date" ? "date" : "text"}
          inputMode={numeric(column) ? "decimal" : undefined}
          aria-label={label}
          aria-invalid={invalid}
          // Focusing the field the user just opened is the expected behaviour.
          autoFocus
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onBlur={() => commit(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              // Without this the same Enter would "click" the cell button and reopen the field.
              event.preventDefault();
              commit(true);
            }
            if (event.key === "Escape") {
              stop(true);
            }
          }}
          className={cn(
            "h-8 w-full min-w-28 rounded-md border border-ring bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
            numeric(column) && "text-right tabular-nums",
            invalid && "border-destructive focus-visible:ring-destructive/30",
          )}
        />
        {invalid && (
          <span role="alert" className="sr-only">
            {t("cell.invalidHint")}
          </span>
        )}
        {editedBy && (
          <p role="status" className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            {t("cell.editedBy", { name: editedBy })}
          </p>
        )}
      </>
    );
  }

  const level = stockLevel(column, value);
  const alertLevel = level === "ok" ? null : level;
  const alert = alertLevel && STOCK_ALERTS[alertLevel];
  const shown = format(column, value) || t("cell.empty");

  return (
    <button
      type="button"
      // The name includes the value, which the visible text alone would not tie to its column.
      aria-label={t("cell.edit", {
        label,
        value: alertLevel ? t(`cell.stock.${alertLevel}`, { value: shown }) : shown,
      })}
      ref={(button) => {
        if (button && returnFocus.current) {
          returnFocus.current = false;
          button.focus();
        }
      }}
      onClick={() => setDraft(toDraft(value))}
      className={cn(
        "flex h-8 w-full min-w-28 items-center rounded-md px-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
        numeric(column) && "justify-end tabular-nums",
        alert && ["gap-1.5", alert.className],
      )}
    >
      {alert && <alert.icon aria-hidden="true" className="size-3.5 shrink-0" />}
      <span className="truncate">{format(column, value)}</span>
    </button>
  );
}

/** What viewers see: the value as text, with the same stock warnings, and no editing. */
export function ReadOnlyCell({
  column,
  value,
  format,
}: Pick<EditableCellProps, "column" | "value" | "format">) {
  const { t } = useTranslation("records");
  if (column.type === "select") {
    const choice = column.options.choices.find((item) => item.label === value);
    return (
      <span className="flex h-8 min-w-28 items-center px-2">
        {choice && (
          <span
            className={cn("truncate rounded-md px-1.5 py-0.5 text-xs", SELECT_CHIP_CLASSES[choice.color])}
          >
            {choice.label}
          </span>
        )}
      </span>
    );
  }
  const level = stockLevel(column, value);
  const alertLevel = level === "ok" ? null : level;
  const alert = alertLevel && STOCK_ALERTS[alertLevel];
  const shown = format(column, value);

  return (
    <span
      className={cn(
        "flex h-8 min-w-28 items-center px-2 text-sm",
        numeric(column) && "justify-end tabular-nums",
        alert && ["gap-1.5", alert.className],
      )}
    >
      {alert && <alert.icon aria-hidden="true" className="size-3.5 shrink-0" />}
      <span className="truncate" aria-hidden={alertLevel ? true : undefined}>
        {shown}
      </span>
      {alertLevel && (
        <span className="sr-only">{t(`cell.stock.${alertLevel}`, { value: shown })}</span>
      )}
    </span>
  );
}
