import { Popover } from "@base-ui/react/popover";
import { useQuery } from "@tanstack/react-query";
import type { CellValue, TableColumn } from "@tablaria/shared";
import { Link2, Loader2, X } from "lucide-react";
import { useDeferredValue, useId, useState } from "react";
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
  onChange: (value: string | null) => void;
  /** Accessible name of the trigger, e.g. "Proveedor de Taladro". */
  label: string;
  id?: string;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

/** Chooses a record of the linked table, searching by its contents. */
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
  const shown = linkedText(value, { ...linked, ...picked });

  if (column.type !== "relation") {
    return null;
  }
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
            <PickerList
              tableId={column.options.tableId}
              required={column.required}
              hasValue={typeof value === "string"}
              onPick={(recordId, recordLabel) => {
                if (recordId) {
                  setPicked((current) => ({ ...current, [recordId]: recordLabel }));
                }
                onChange(recordId);
                setOpen(false);
                onOpenChange?.(false);
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function PickerList({
  tableId,
  required,
  hasValue,
  onPick,
}: {
  tableId: string;
  required: boolean;
  hasValue: boolean;
  onPick: (recordId: string | null, label: string) => void;
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
            return (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => onPick(record.id, text)}
                  className="w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {text || t("relation.untitled")}
                </button>
              </li>
            );
          })}
          {records.data?.data.length === 0 && (
            <li className="px-1 py-2 text-sm text-muted-foreground">{t("relation.noResults")}</li>
          )}
        </ul>
      )}
      {hasValue && !required && (
        <button
          type="button"
          onClick={() => onPick(null, "")}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X aria-hidden="true" className="size-3.5" />
          {t("relation.clear")}
        </button>
      )}
    </div>
  );
}
