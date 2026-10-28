import { hasRole, type TableColumn, type TableDetail } from "@wisedata/shared";
import { ArrowDown, ArrowUp, Columns3, Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useReorderColumns } from "@/features/tables/queries";
import { cn } from "@/lib/utils";
import { ColumnDialog } from "./ColumnDialog";
import { COLUMN_TYPE_ICONS, SELECT_CHIP_CLASSES } from "./column-ui";
import { DeleteColumnDialog } from "./DeleteColumnDialog";
import { useCellFormatter } from "./format-value";

const VISIBLE_CHOICES = 4;

/** The column stays set while a dialog closes, so its content doesn't change mid-animation. */
interface DialogState {
  kind: "create" | "edit" | "delete" | null;
  column?: TableColumn;
}

export function ColumnList({ table }: { table: TableDetail }) {
  const { t } = useTranslation("tables");
  const [dialog, setDialog] = useState<DialogState>({ kind: null });
  const [announcement, setAnnouncement] = useState("");
  const reorder = useReorderColumns(table.id);
  const { columns } = table;
  // Only admins change columns; everyone else sees the list without its controls.
  const canManage = hasRole(table.role, "ADMIN");

  const move = (index: number, offset: -1 | 1) => {
    const ids = columns.map(({ id }) => id);
    const target = index + offset;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setAnnouncement(t("columns.moved", { name: columns[index].name, position: target + 1 }));
    reorder.mutate(ids, { onError: () => toast.error(t("columns.reorderError")) });
  };

  const close = (open: boolean) => !open && setDialog((current) => ({ ...current, kind: null }));
  const addButton = (
    <Button className="h-9" onClick={() => setDialog({ kind: "create" })}>
      <Plus aria-hidden="true" />
      {t("columns.add")}
    </Button>
  );

  return (
    <section aria-labelledby="columns-title" className="mt-6 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="columns-title" className="text-lg font-semibold tracking-tight">
            {t("columns.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("columns.description")}</p>
        </div>
        {canManage && columns.length > 0 && addButton}
      </div>

      {columns.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <Columns3 aria-hidden="true" className="mx-auto size-7 text-primary" strokeWidth={1.5} />
          <h3 className="mt-3 font-semibold tracking-tight">{t("columns.emptyTitle")}</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            {canManage ? t("columns.emptyDescription") : t("columns.emptyReadOnly")}
          </p>
          {canManage && <div className="mt-5">{addButton}</div>}
        </div>
      ) : (
        <ol className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {columns.map((column, index) => (
            <ColumnRow
              key={column.id}
              canManage={canManage}
              column={column}
              isFirst={index === 0}
              isLast={index === columns.length - 1}
              onMove={(offset) => move(index, offset)}
              onEdit={() => setDialog({ kind: "edit", column })}
              onDelete={() => setDialog({ kind: "delete", column })}
            />
          ))}
        </ol>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ColumnDialog
        tableId={table.id}
        recordCount={table.recordCount}
        column={dialog.kind === "create" ? undefined : dialog.column}
        open={dialog.kind === "create" || dialog.kind === "edit"}
        onOpenChange={close}
      />
      {dialog.kind === "delete" && dialog.column && (
        <DeleteColumnDialog tableId={table.id} column={dialog.column} onOpenChange={close} />
      )}
    </section>
  );
}

function ColumnRow({
  column,
  canManage,
  isFirst,
  isLast,
  onMove,
  onEdit,
  onDelete,
}: {
  column: TableColumn;
  canManage: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (offset: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("tables");
  const Icon = COLUMN_TYPE_ICONS[column.type];
  const format = useCellFormatter();
  const defaultValue = format(column, column.defaultValue);
  const details = [
    column.type === "currency"
      ? `${t(`types.${column.type}`)} · ${column.options.currency}`
      : t(`types.${column.type}`),
    column.required && t("columns.required"),
    defaultValue && t("columns.default", { value: defaultValue }),
    column.type === "number" &&
      column.options &&
      t("columns.alertBelow", { value: format(column, column.options.alertBelow) }),
  ].filter(Boolean);

  return (
    <li className="flex items-center gap-3 px-3 py-3 sm:px-4">
      <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:flex">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{column.name}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{details.join(" · ")}</p>
        {column.type === "select" && (
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {column.options.choices.slice(0, VISIBLE_CHOICES).map((choice) => (
              <li
                key={choice.id}
                className={cn("rounded-md px-1.5 py-0.5 text-xs", SELECT_CHIP_CLASSES[choice.color])}
              >
                {choice.label}
              </li>
            ))}
            {column.options.choices.length > VISIBLE_CHOICES && (
              <li className="px-1 py-0.5 text-xs text-muted-foreground">
                +{column.options.choices.length - VISIBLE_CHOICES}
              </li>
            )}
          </ul>
        )}
      </div>
      {canManage && (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={t("columns.moveUp", { name: column.name })}
            disabled={isFirst}
            onClick={() => onMove(-1)}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={t("columns.moveDown", { name: column.name })}
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label={t("columns.options", { name: column.name })}
                />
              }
            >
              <Ellipsis aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil aria-hidden="true" />
                {t("columns.edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 aria-hidden="true" />
                {t("columns.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  );
}
