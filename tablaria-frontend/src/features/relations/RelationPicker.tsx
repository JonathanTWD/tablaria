import { Popover } from "@base-ui/react/popover";
import { useQuery } from "@tanstack/react-query";
import { type CellValue, linkedRecordIds, type TableColumn } from "@tablaria/shared";
import { Check, Link2, Loader2, X } from "lucide-react";
import { type RefObject, useDeferredValue, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { recordsQuery } from "@/features/records/queries";
import { tableQuery } from "@/features/tables/queries";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useLinkedText } from "./linked-text";

/** Records listed per search: enough to choose, few enough to scan. */
const RESULTS = 10;

interface RelationPickerProps {
  column: TableColumn;
  value: CellValue | undefined;
  /** Labels the records list brought for the current values. */
  linked: Record<string, string>;
  /** A record id, a list of them for a multiple relation (ADR-032), or null. */
  onChange: (value: string | string[] | null) => void;
  /** Accessible name of the trigger, e.g. "Proveedor de Taladro". */
  label: string;
  id?: string;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Chooses a record of the linked table, searching by its contents, or
 * several when the relation is multiple: then each pick adds or removes one
 * and the list stays open.
 */
export function RelationPicker({
  column,
  value,
  linked,
  onChange,
  label,
  id,
  className,
  onOpenChange,
}: RelationPickerProps) {
  const { t } = useTranslation("records");
  const linkedText = useLinkedText();
  const [open, setOpen] = useState(false);
  // Shown until the records list refetches with the new label.
  const [picked, setPicked] = useState<Record<string, string>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const labels = { ...linked, ...picked };
  const shown = linkedText(value, labels);

  if (column.type !== "relation") {
    return null;
  }
  const multiple = column.options.multiple;
  const selected = linkedRecordIds(value);
  // A required relation keeps at least one link.
  const canRemove = !column.required || selected.length > 1;

  const close = () => {
    setOpen(false);
    onOpenChange?.(false);
  };
  const toggle = (recordId: string) => {
    const next = selected.includes(recordId)
      ? selected.filter((item) => item !== recordId)
      : [...selected, recordId];
    onChange(next.length > 0 ? next : null);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
      }}
    >
      <Popover.Trigger
        id={id}
        aria-label={`${label}: ${shown || t("dialog.empty")}`}
        className={cn(
          "flex h-8 w-full min-w-28 items-center gap-1.5 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
          className,
        )}
      >
        {shown && <Link2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />}
        <span className="truncate">{shown}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="isolate z-50 outline-none" align="start" sideOffset={4}>
          <Popover.Popup className="w-72 max-w-[calc(100vw-2rem)] rounded-lg bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
            {multiple && selected.length > 0 && (
              <SelectedList
                ids={selected}
                labelOf={(recordId) => linkedText(recordId, labels)}
                canRemove={canRemove}
                onRemove={(recordId) => {
                  toggle(recordId);
                  // Its button goes away: keep the focus in the popup.
                  searchRef.current?.focus();
                }}
              />
            )}
            <PickerList
              tableId={column.options.tableId}
              searchRef={searchRef}
              multiple={multiple}
              selected={multiple ? selected : []}
              canClear={selected.length > 0 && !column.required}
              clearLabel={multiple ? t("relation.clearAll") : t("relation.clear")}
              isLocked={(recordId) => !canRemove && selected.includes(recordId)}
              onPick={(recordId, recordLabel) => {
                setPicked((current) => ({ ...current, [recordId]: recordLabel }));
                if (multiple) {
                  toggle(recordId);
                } else {
                  onChange(recordId);
                  close();
                }
              }}
              onClear={() => {
                onChange(null);
                close();
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The records a multiple relation links to, each removable on its own. */
function SelectedList({
  ids,
  labelOf,
  canRemove,
  onRemove,
}: {
  ids: string[];
  labelOf: (recordId: string) => string;
  canRemove: boolean;
  onRemove: (recordId: string) => void;
}) {
  const { t } = useTranslation("records");
  const headingId = useId();
  return (
    <div className="mb-2 flex flex-col gap-1.5 border-b pb-2">
      <p id={headingId} className="px-1 text-xs font-medium text-muted-foreground">
        {t("relation.selected")}
      </p>
      <ul aria-labelledby={headingId} className="flex flex-wrap gap-1">
        {ids.map((recordId) => {
          const text = labelOf(recordId);
          return (
            <li key={recordId}>
              <span className="flex max-w-60 items-center gap-0.5 rounded-md bg-muted py-0.5 pr-0.5 pl-2 text-sm">
                <span className="truncate">{text}</span>
                {canRemove && (
                  <button
                    type="button"
                    aria-label={t("relation.remove", { label: text })}
                    onClick={() => onRemove(recordId)}
                    className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PickerList({
  tableId,
  searchRef,
  multiple,
  selected,
  canClear,
  clearLabel,
  isLocked,
  onPick,
  onClear,
}: {
  tableId: string;
  searchRef: RefObject<HTMLInputElement | null>;
  multiple: boolean;
  /** Records already linked, for a multiple relation: picking one removes it. */
  selected: string[];
  canClear: boolean;
  clearLabel: string;
  /** A linked record that can't be removed: the last of a required relation. */
  isLocked: (recordId: string) => boolean;
  onPick: (recordId: string, label: string) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation("records");
  const ids = useId();
  const [search, setSearch] = useState("");
  // Typing stays responsive while the previous results are still shown.
  const query = useDeferredValue(search.trim());
  const table = useQuery(tableQuery(tableId));
  const records = useQuery({
    ...recordsQuery(tableId, {
      page: 1,
      pageSize: RESULTS,
      search: query,
      order: "asc",
      filters: [],
    }),
    enabled: table.isSuccess,
  });
  const firstColumn = table.data?.columns[0];
  const noAccess = table.error instanceof ApiError && table.error.status === 404;

  return (
    <div className="flex flex-col gap-2">
      <Input
        // The popup opens to search: the field takes the focus.
        autoFocus
        ref={searchRef}
        aria-label={t("relation.search", { name: table.data?.name ?? "" })}
        aria-controls={`${ids}-results`}
        placeholder={t("relation.searchPlaceholder")}
        className="h-8"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {noAccess ? (
        <p className="px-1 py-2 text-sm text-muted-foreground">{t("relation.noAccess")}</p>
      ) : (
        <ul id={`${ids}-results`} aria-busy={records.isFetching} className="flex max-h-64 flex-col overflow-y-auto">
          {records.isPending && (
            <li className="flex justify-center py-3">
              <Loader2 aria-hidden="true" className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
            </li>
          )}
          {records.data?.data.map((record) => {
            const text = firstColumn ? String(record.data[firstColumn.id] ?? "") : "";
            const isSelected = selected.includes(record.id);
            return (
              <li key={record.id}>
                <button
                  type="button"
                  // Only a multiple relation toggles: say whether each is linked.
                  aria-pressed={multiple ? isSelected : undefined}
                  disabled={isLocked(record.id)}
                  onClick={() => onPick(record.id, text)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="truncate">{text || t("relation.untitled")}</span>
                  {isSelected && <Check aria-hidden="true" className="ml-auto size-3.5 shrink-0" />}
                </button>
              </li>
            );
          })}
          {records.data?.data.length === 0 && (
            <li className="px-1 py-2 text-sm text-muted-foreground">{t("relation.noResults")}</li>
          )}
        </ul>
      )}
      {canClear && (
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X aria-hidden="true" className="size-3.5" />
          {clearLabel}
        </button>
      )}
    </div>
  );
}
