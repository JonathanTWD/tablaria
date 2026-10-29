import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import {
  hasRole,
  type RecordFilter,
  type TableColumn,
  type TableDetail,
  type TableRecord,
} from "@wisedata/shared";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ellipsis,
  FileUp,
  Pencil,
  Plus,
  Rows3,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { type FocusEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCellFormatter, type CellFormatter } from "@/features/columns/format-value";
import { apiErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { DeleteRecordDialog } from "./DeleteRecordDialog";
import { useSession } from "@/features/auth/session";
import { presenceColor } from "@/features/realtime/presence-colors";
import { useTablePresence } from "@/features/realtime/realtime-context";
import { EditableCell, ReadOnlyCell } from "./EditableCell";
import { ExportButton } from "./ExportButton";
import { ImportDialog } from "@/features/imports/ImportDialog";
import { FiltersSheet } from "./FiltersSheet";
import { RecordDialog } from "./RecordDialog";
import { RecordsPagination } from "./RecordsPagination";
import { recordsQuery, useUpdateRecord } from "./queries";
import { applicableView, useRecordsView } from "./records-view";

// Sorting runs on the server; TanStack Table only tracks which header is active.
const recordTableFeatures = tableFeatures({ rowSortingFeature });
const columnHelper = createColumnHelper<typeof recordTableFeatures, TableRecord>();

const SEARCH_DEBOUNCE_MS = 300;

interface DialogState {
  kind: "create" | "edit" | "delete" | null;
  record?: TableRecord;
}

/** The first column (the record's name) stays visible while the table scrolls sideways. */
const STICKY_CELL = "sticky left-0 z-10 shadow-[inset_-1px_0_0_var(--border)]";

/**
 * The browser scrolls a cell focused from the keyboard to the scroller's edge,
 * which is under the sticky first column. Padding the scroll area by that
 * column's width before the browser scrolls (it does so after this event)
 * keeps the focused cell next to it instead.
 */
function keepFocusBesideStickyColumn(event: FocusEvent<HTMLDivElement>) {
  const sticky = event.target.closest("tr")?.firstElementChild;
  if (sticky) {
    event.currentTarget.style.scrollPaddingLeft = `${sticky.getBoundingClientRect().width}px`;
  }
}

export function RecordsTable({ table }: { table: TableDetail }) {
  const { t } = useTranslation("records");
  const [urlView, setView] = useRecordsView();
  const { columns } = table;
  const view = applicableView(urlView, columns);
  const records = useQuery(recordsQuery(table.id, view));
  const update = useUpdateRecord(table.id);
  const { t: tTables } = useTranslation("tables");
  const { data: user } = useSession();
  const { viewers, setEditing } = useTablePresence(table.id);
  const othersEditing = viewers.filter(
    (viewer) => viewer.editing && viewer.userId !== user?.id,
  );
  /** "recordId:columnId" → the other person editing that cell. */
  const editedByOthers = new Map(
    othersEditing.map((viewer) => [`${viewer.editing?.recordId}:${viewer.editing?.columnId}`, viewer]),
  );
  /** Record id → the other people editing any of its cells. */
  const recordEditors = new Map<string, typeof othersEditing>();
  for (const viewer of othersEditing) {
    const recordId = viewer.editing?.recordId ?? "";
    recordEditors.set(recordId, [...(recordEditors.get(recordId) ?? []), viewer]);
  }
  const nameOf = (viewer: (typeof othersEditing)[number]) =>
    viewer.name ?? tTables("presence.guest");
  // The API enforces these too; the interface just doesn't offer what would be refused.
  const canEdit = hasRole(table.role, "EDITOR");
  const canManage = hasRole(table.role, "ADMIN");
  const format = useCellFormatter();
  const [dialog, setDialog] = useState<DialogState>({ kind: null });
  const [importing, setImporting] = useState(false);

  // A page past the end (e.g. after deleting its last record) moves to the last one.
  const lastPage = records.data && Math.max(records.data.meta.pageCount, 1);
  useEffect(() => {
    if (lastPage !== undefined && view.page > lastPage) {
      setView({ page: lastPage }, { replace: true });
    }
  }, [lastPage, view.page, setView]);

  const sorting: SortingState = view.sort ? [{ id: view.sort, desc: view.order === "desc" }] : [];
  const onSortingChange = (updater: Updater<SortingState>) => {
    const [next] = typeof updater === "function" ? updater(sorting) : updater;
    setView({ sort: next?.id, order: next?.desc ? "desc" : "asc" });
  };

  const tableColumns = useMemo(
    () =>
      columnHelper.columns(
        columns.map((column) =>
          columnHelper.accessor((record) => record.data[column.id], {
            id: column.id,
            // A relation holds a record id: sorting by it would mean nothing.
            enableSorting: column.type !== "relation",
          }),
        ),
      ),
    [columns],
  );

  const grid = useTable({
    features: recordTableFeatures,
    columns: tableColumns,
    data: records.data?.data ?? [],
    state: { sorting },
    onSortingChange,
    manualSorting: true,
    // TanStack starts numeric columns descending; ascending first is more predictable.
    sortDescFirst: false,
    // One header at a time; a third click goes back to creation order.
    enableMultiSort: false,
    getRowId: (record) => record.id,
  });

  const rowLabel = (record: TableRecord) =>
    format(columns[0], record.data[columns[0]?.id]) || t("table.untitled");

  const save = (record: TableRecord, column: TableColumn, value: TableRecord["data"][string]) =>
    update.mutate(
      { recordId: record.id, changes: { [column.id]: value } },
      { onError: () => toast.error(t("cell.saveError")) },
    );

  const hasQuery = view.search !== "" || view.filters.length > 0;
  const closeDialog = (open: boolean) =>
    !open && setDialog((current) => ({ ...current, kind: null }));

  const importDialog = canEdit && (
    <ImportDialog destination={{ kind: "table", table }} open={importing} onOpenChange={setImporting} />
  );

  if (columns.length === 0) {
    return (
      <>
        <EmptyState
          title={t("empty.noColumnsTitle")}
          description={
            canManage ? t("empty.noColumnsDescriptionImport") : t("empty.noColumnsDescription")
          }
          action={
            canManage && (
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="columns" className={cn(buttonVariants(), "h-9")}>
                  {t("empty.noColumnsAction")}
                </Link>
                {/* Admins can create the columns from a file's headers. */}
                <Button variant="outline" className="h-9" onClick={() => setImporting(true)}>
                  <FileUp aria-hidden="true" />
                  {t("toolbar.import")}
                </Button>
              </div>
            )
          }
        />
        {importDialog}
      </>
    );
  }

  return (
    <section aria-label={t("tabs.records")} className="mt-4">
      {!canEdit && (
        <p className="mb-3 text-sm text-muted-foreground">{t("readOnly")}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          initial={view.search}
          onSearch={(search) => setView({ search }, { replace: true })}
        />
        <FiltersSheet
          columns={columns}
          filters={view.filters}
          onApply={(filters) => setView({ filters })}
        />
        <ExportButton tableId={table.id} view={view} />
        {canEdit && (
          <Button variant="outline" className="h-9" onClick={() => setImporting(true)}>
            <FileUp aria-hidden="true" />
            {t("toolbar.import")}
          </Button>
        )}
        {canEdit && (
          <Button className="h-9 sm:ml-auto" onClick={() => setDialog({ kind: "create" })}>
            <Plus aria-hidden="true" />
            {t("toolbar.add")}
          </Button>
        )}
      </div>

      {view.filters.length > 0 && (
        <FilterChips
          columns={columns}
          filters={view.filters}
          format={format}
          onRemove={(columnId) =>
            setView({ filters: view.filters.filter((filter) => filter.columnId !== columnId) })
          }
        />
      )}

      {records.isError ? (
        <div className="mt-4 flex flex-col items-start gap-3">
          <FormAlert>
            {t("loadError")} {apiErrorMessage(records.error)}
          </FormAlert>
          <Button variant="outline" className="h-9" onClick={() => void records.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            // `relative` keeps absolutely positioned cell parts (hidden inputs) inside the scroll area.
            "relative mt-4 overflow-x-auto rounded-xl border border-border bg-card transition-opacity",
            records.isPlaceholderData && "opacity-60",
          )}
          aria-busy={records.isFetching}
          onFocus={keepFocusBesideStickyColumn}
        >
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t("table.caption", { name: table.name })}</caption>
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left">
                {grid.getHeaderGroups()[0].headers.map((header, index) => {
                  const column = columns[index];
                  const sorted = header.column.getIsSorted();
                  const SortIcon =
                    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
                  const numeric = column.type === "number" || column.type === "currency";
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                      }
                      className={cn(
                        "px-1.5 py-1.5 font-medium whitespace-nowrap",
                        numeric && "text-right",
                        index === 0 && cn(STICKY_CELL, "bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"),
                      )}
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                          numeric && "flex-row-reverse",
                          sorted && "text-foreground",
                        )}
                      >
                        {column.name}
                        <SortIcon aria-hidden="true" className="size-3.5" />
                      </button>
                    </th>
                  );
                })}
                {canEdit && (
                  <th scope="col" className="w-12 px-1.5">
                    <span className="sr-only">{t("table.actions")}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {records.isPending
                ? Array.from({ length: 5 }, (_, row) => (
                    <tr key={row} className="border-b border-border last:border-b-0">
                      {columns.map((column) => (
                        <td key={column.id} className="px-3 py-3">
                          <Skeleton className="h-4 w-full min-w-20" />
                        </td>
                      ))}
                      <td />
                    </tr>
                  ))
                : grid.getRowModel().rows.map((row) => {
                    const record = row.original;
                    const label = rowLabel(record);
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "group border-b border-border last:border-b-0 hover:bg-muted/30",
                          // Someone is editing this record: tinted, but nothing is locked.
                          recordEditors.has(record.id) &&
                            presenceColor(recordEditors.get(record.id)![0].userId).row,
                        )}
                      >
                        {columns.map((column, index) => {
                          const editor = editedByOthers.get(`${record.id}:${column.id}`);
                          const editorName = editor && nameOf(editor);
                          return (
                          <td
                            key={column.id}
                            className={cn(
                              "px-1.5 py-1 align-middle",
                              editor && ["relative ring-2 ring-inset", presenceColor(editor.userId).ring],
                              // Opaque, so scrolled cells never show through the fixed column.
                              index === 0 &&
                                cn(
                                  STICKY_CELL,
                                  "bg-card group-hover:bg-[color-mix(in_oklab,var(--muted)_30%,var(--card))]",
                                ),
                            )}
                          >
                            {/* On phones the fixed column must leave room for the cell being edited. */}
                            <div className={cn(index === 0 && "max-w-36 sm:max-w-56 lg:max-w-none")}>
                              {canEdit ? (
                                <EditableCell
                                  column={column}
                                  value={record.data[column.id]}
                                  label={t("cell.label", { column: column.name, row: label })}
                                  format={format}
                                  onSave={(value) => save(record, column, value)}
                                  presence={{ recordId: record.id, setEditing }}
                                  editedBy={editorName}
                                  linked={records.data?.linked}
                                />
                              ) : (
                                <ReadOnlyCell
                                  column={column}
                                  value={record.data[column.id]}
                                  format={format}
                                  linked={records.data?.linked}
                                />
                              )}
                            </div>
                            {editor && (
                              <span
                                className={cn(
                                  "pointer-events-none absolute -top-2 right-1 z-20 max-w-24 truncate rounded px-1 text-[10px] leading-4 font-medium text-white",
                                  presenceColor(editor.userId).avatar,
                                )}
                              >
                                <span aria-hidden="true">{editorName}</span>
                                <span className="sr-only">
                                  {tTables("presence.editingCell", { name: editorName })}
                                </span>
                              </span>
                            )}
                          </td>
                          );
                        })}
                        {canEdit && (
                          <td className="px-1.5 py-1 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t("table.rowActions", { label })}
                                  />
                                }
                              >
                                <Ellipsis aria-hidden="true" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem onClick={() => setDialog({ kind: "edit", record })}>
                                  <Pencil aria-hidden="true" />
                                  {t("table.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDialog({ kind: "delete", record })}
                                >
                                  <Trash2 aria-hidden="true" />
                                  {t("table.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        )}
                      </tr>
                    );
                  })}
            </tbody>
          </table>

          {records.data?.meta.total === 0 &&
            (hasQuery ? (
              <EmptyState
                title={t("empty.noResultsTitle")}
                description={t("empty.noResultsDescription")}
                action={
                  <Button
                    variant="outline"
                    className="h-9"
                    onClick={() => setView({ search: "", filters: [] })}
                  >
                    {t("empty.clear")}
                  </Button>
                }
              />
            ) : (
              <EmptyState title={t("empty.title")} description={t("empty.description")} />
            ))}
        </div>
      )}

      {records.data && records.data.meta.total > 0 && (
        <RecordsPagination
          meta={records.data.meta}
          onPageChange={(page) => setView({ page })}
          onPageSizeChange={(pageSize) => setView({ pageSize })}
        />
      )}

      <RecordDialog
        tableId={table.id}
        columns={columns}
        linked={records.data?.linked}
        record={dialog.kind === "create" ? undefined : dialog.record}
        editingBy={
          dialog.kind === "edit" && dialog.record
            ? recordEditors.get(dialog.record.id)?.map(nameOf)
            : undefined
        }
        open={dialog.kind === "create" || dialog.kind === "edit"}
        onOpenChange={closeDialog}
      />
      {dialog.kind === "delete" && dialog.record && (
        <DeleteRecordDialog
          tableId={table.id}
          recordId={dialog.record.id}
          label={rowLabel(dialog.record)}
          onOpenChange={closeDialog}
        />
      )}
      {importDialog}
    </section>
  );
}

/** Updates the URL once the user pauses typing, not on every key. */
function SearchField({ initial, onSearch }: { initial: string; onSearch: (search: string) => void }) {
  const { t } = useTranslation("records");
  const id = useId();
  const [value, setValue] = useState(initial);
  // Follows resets from outside the field ("clear filters", back button) without
  // fighting the user's own typing, which reaches the URL trimmed.
  const [synced, setSynced] = useState(initial);
  if (initial !== synced) {
    setSynced(initial);
    if (initial !== value.trim()) {
      setValue(initial);
    }
  }
  const timer = useRef<number | undefined>(undefined);

  return (
    <div className="relative w-full sm:w-72">
      <label htmlFor={id} className="sr-only">
        {t("toolbar.search")}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id={id}
        type="search"
        value={value}
        placeholder={t("toolbar.searchPlaceholder")}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => onSearch(next.trim()), SEARCH_DEBOUNCE_MS);
        }}
        className="h-9 pl-8"
      />
    </div>
  );
}

function FilterChips({
  columns,
  filters,
  format,
  onRemove,
}: {
  columns: TableColumn[];
  filters: RecordFilter[];
  format: CellFormatter;
  onRemove: (columnId: string) => void;
}) {
  const { t } = useTranslation("records");

  const describe = (column: TableColumn, filter: RecordFilter) => {
    switch (filter.op) {
      case "contains":
        return t("filters.chipContains", { column: column.name, value: filter.value });
      case "is":
        return t("filters.chipIs", { column: column.name, value: format(column, filter.value) });
      case "in":
        return t("filters.chipIn", { column: column.name, values: filter.values.join(", ") });
      case "between": {
        const min = filter.min === undefined ? undefined : format(column, filter.min);
        const max = filter.max === undefined ? undefined : format(column, filter.max);
        if (min !== undefined && max !== undefined) {
          return t("filters.chipRange", { column: column.name, min, max });
        }
        return min !== undefined
          ? t("filters.chipMin", { column: column.name, min })
          : t("filters.chipMax", { column: column.name, max });
      }
    }
  };

  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {filters.map((filter) => {
        const column = columns.find((item) => item.id === filter.columnId);
        if (!column) {
          return null;
        }
        return (
          <li
            key={filter.columnId}
            className="flex h-7 items-center gap-1 rounded-full border border-primary/30 bg-primary/5 pr-1 pl-3 text-xs"
          >
            {describe(column, filter)}
            <button
              type="button"
              aria-label={t("filters.remove", { column: column.name })}
              onClick={() => onRemove(filter.columnId)}
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <Rows3 aria-hidden="true" className="size-7 text-primary" strokeWidth={1.5} />
      <p className="mt-3 font-semibold tracking-tight">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
