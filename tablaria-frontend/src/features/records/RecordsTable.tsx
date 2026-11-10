import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import {
  canGroupRecordsBy,
  hasRole,
  isComputedType,
  type RecordFilter,
  type TableColumn,
  type TableDetail,
  type TableRecord,
} from "@tablaria/shared";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ellipsis,
  FileText,
  FileUp,
  ArrowDownUp,
  PenLine,
  Pencil,
  Plus,
  QrCode,
  Rows3,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { type FocusEvent, Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
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
import { apiErrorMessage, repeatedValues } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { DeleteRecordDialog } from "./DeleteRecordDialog";
import { useSession } from "@/features/auth/session";
import { presenceColor } from "@/features/realtime/presence-colors";
import { useTablePresence } from "@/features/realtime/realtime-context";
import { EditableCell, ReadOnlyCell } from "./EditableCell";
import { ExportButton } from "./ExportButton";
import { MoreActionsMenu } from "./MoreActionsMenu";
import { ImportDialog } from "@/features/imports/ImportDialog";
import { interpretScan } from "@/features/scanner/scan-result";
import { ScanButton } from "@/features/scanner/ScanButton";
import { FiltersSheet } from "./FiltersSheet";
import { GroupBySelect } from "./GroupBySelect";
import { groupValueOf } from "./record-groups";
import { SavedViewsMenu } from "@/features/saved-views/SavedViewsMenu";
import { BatchDeleteDialog, BatchEditDialog } from "./BatchDialogs";
import { RecordDialog } from "./RecordDialog";
import { RecordSheet } from "./RecordSheet";
import { shownColumn } from "./shown-column";
import { RecordsPagination } from "./RecordsPagination";
import { recordsQuery, useUpdateRecord } from "./queries";
import { StockDialog } from "@/features/stock-movements/StockDialog";
import { applicableView, useRecordsView, viewSearchParams } from "./records-view";

// Sorting runs on the server; TanStack Table only tracks which header is active.
const recordTableFeatures = tableFeatures({ rowSortingFeature });
const columnHelper = createColumnHelper<typeof recordTableFeatures, TableRecord>();

const SEARCH_DEBOUNCE_MS = 300;

interface DialogState {
  kind: "create" | "edit" | "delete" | "stock" | "batchEdit" | "batchDelete" | null;
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
  const groupColumn = columns.find(({ id }) => id === view.group);
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
  const stockColumns = columns.filter((column) => column.stock);
  const canManage = hasRole(table.role, "ADMIN");
  const format = useCellFormatter();
  const [dialog, setDialog] = useState<DialogState>({ kind: null });
  // Records ticked for a batch edit, for one view: changing page, search,
  // filter or sort starts afresh, so no tick acts on, or comes back to, rows
  // out of sight. Records that leave the page (deleted by someone) drop out.
  const viewKey = JSON.stringify(view);
  const [ticks, setTicks] = useState<{ view: string; ids: ReadonlySet<string> }>({
    view: viewKey,
    ids: new Set(),
  });
  const ticked = ticks.view === viewKey ? ticks.ids : new Set<string>();
  const setTicked = (ids: ReadonlySet<string>) => setTicks({ view: viewKey, ids });
  const pageIds = records.data?.data.map(({ id }) => id) ?? [];
  const selection = pageIds.filter((id) => ticked.has(id));
  const allTicked = pageIds.length > 0 && selection.length === pageIds.length;
  const toggle = (id: string) => {
    const next = new Set(ticked);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setTicked(next);
  };
  const clearSelection = () => setTicked(new Set());
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

  // Relations sort and filter by their linked record's label, when the user can open its table.
  const labelledRelations = records.data?.labelledRelations;
  const tableColumns = useMemo(
    () =>
      columnHelper.columns(
        columns.map((column) =>
          columnHelper.accessor((record) => record.data[column.id], {
            id: column.id,
            enableSorting:
              column.type === "relation"
                ? (labelledRelations ?? []).includes(column.id)
                : column.type === "lookup"
                  ? column.id in table.lookupTargets
                  : // By their value, only when the user can open what they sum up (ADR-034).
                    column.type === "rollup"
                    ? column.id in table.rollupTargets
                    : column.type !== "formula",
          }),
        ),
      ),
    [columns, labelledRelations, table.lookupTargets, table.rollupTargets],
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
      {
        onError: (error) =>
          toast.error(
            repeatedValues(error).length > 0
              ? t("cell.duplicate", { value: format(column, value), column: column.name })
              : t("cell.saveError"),
          ),
      },
    );

  const hasQuery = view.search !== "" || view.filters.length > 0;
  const closeDialog = (open: boolean) =>
    !open && setDialog((current) => ({ ...current, kind: null }));

  // A record's sheet lives in the URL (`?record=`): what its QR label opens (ADR-038).
  const [params, setParams] = useSearchParams();
  const openRecord = params.get("record");
  const showRecord = (recordId: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (recordId) {
        next.set("record", recordId);
      } else {
        next.delete("record");
      }
      return next;
    });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t: tScanner } = useTranslation("scanner");
  // A record's label opens it; any other code is searched for, and a single match opens (ADR-051).
  const handleScan = async (raw: string) => {
    const scanned = interpretScan(raw);
    if (scanned.kind === "record") {
      if (scanned.tableId === table.id) {
        showRecord(scanned.recordId);
      } else {
        void navigate(scanned.path);
      }
      return;
    }
    let single: string | undefined;
    try {
      const found = await queryClient.fetchQuery(
        recordsQuery(table.id, { ...view, search: scanned.value, page: 1 }),
      );
      single = found.meta.total === 1 ? found.data[0]?.id : undefined;
    } catch {
      // The search is applied either way; the list then shows its own loading error.
    }
    // One URL change for both: a second setParams would start from the stale URL and drop the search.
    setParams((current) => {
      const next = viewSearchParams(current, { search: scanned.value });
      if (single) {
        next.set("record", single);
      }
      return next;
    });
  };

  const labelsParams = new URLSearchParams(params);
  labelsParams.delete("record");
  const labelsUrl = `/app/tables/${table.id}/labels${labelsParams.size > 0 ? `?${labelsParams}` : ""}`;

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
    // Room at the bottom for the selection bar, so it never hides the pagination.
    <section aria-label={t("tabs.records")} className={cn("mt-4", canEdit && selection.length > 0 && "pb-24")}>
      {!canEdit && (
        <p className="mb-3 text-sm text-muted-foreground">{t("readOnly")}</p>
      )}
      {/* Sized by its own width, so it adapts to the sidebar as well as the screen. */}
      <div className="@container/toolbar">
      <div className="flex flex-wrap items-center gap-2">
        <SavedViewsMenu tableId={table.id} view={view} canEdit={canEdit} onOpen={(next) => setView(next)} />
        <SearchField
          initial={view.search}
          onSearch={(search) => setView({ search }, { replace: true })}
        />
        <ScanButton description={tScanner("table.description")} onScan={(value) => void handleScan(value)} />
        <FiltersSheet
          columns={columns
            .filter((column) =>
              column.type === "relation"
                ? (labelledRelations ?? []).includes(column.id)
                : column.type === "lookup" || column.type === "rollup"
                  ? column.id in table.lookupTargets || column.id in table.rollupTargets
                  : column.type !== "formula",
            )
            // A rollup filters by a range of what it shows: a number, a price or a date.
            .map((column) =>
              column.type === "rollup"
                ? { ...shownColumn(table, column), id: column.id, name: column.name }
                : column,
            )}
          filters={view.filters}
          onApply={(filters) => setView({ filters })}
        />
        <GroupBySelect
          columns={columns.filter(
            (column) =>
              canGroupRecordsBy(column) &&
              (column.type !== "relation" || (labelledRelations ?? []).includes(column.id)),
          )}
          value={view.group}
          onChange={(group) => setView({ group })}
        />
        {/* Actions on the right; the occasional ones fold into "Más" when the
            row has no room for them (about 1,430px with every button). */}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 @min-[96rem]/toolbar:flex">
            <ExportButton tableId={table.id} view={view} />
            <Link to={labelsUrl} className={cn(buttonVariants({ variant: "outline" }), "h-9")}>
              <QrCode aria-hidden="true" />
              {t("qr.labels")}
            </Link>
            {canEdit && (
              <Button variant="outline" className="h-9" onClick={() => setImporting(true)}>
                <FileUp aria-hidden="true" />
                {t("toolbar.import")}
              </Button>
            )}
          </div>
          <MoreActionsMenu
            tableId={table.id}
            view={view}
            labelsUrl={labelsUrl}
            onImport={canEdit ? () => setImporting(true) : undefined}
            className="h-9 @min-[96rem]/toolbar:hidden"
          />
          {canEdit && (
            <Button className="h-9" onClick={() => setDialog({ kind: "create" })}>
              <Plus aria-hidden="true" />
              {t("toolbar.add")}
            </Button>
          )}
        </div>
      </div>
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
                  const shown = shownColumn(table, column);
                  const numeric = shown.type === "number" || shown.type === "currency";
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
                      <div className="flex items-center gap-1">
                      {index === 0 && canEdit && (
                        <input
                          type="checkbox"
                          aria-label={t("batch.selectPage")}
                          className="mx-1.5 size-4 shrink-0 cursor-pointer accent-primary"
                          checked={allTicked}
                          ref={(box) => {
                            if (box) {
                              box.indeterminate = selection.length > 0 && !allTicked;
                            }
                          }}
                          disabled={pageIds.length === 0}
                          onChange={() => setTicked(allTicked ? new Set() : new Set(pageIds))}
                        />
                      )}
                      {header.column.getCanSort() ? (
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
                      ) : (
                        // Not a button: a relation to a table the user can't open doesn't sort.
                        <span className="inline-flex h-8 items-center px-1.5 text-muted-foreground">
                          {column.name}
                        </span>
                      )}
                      </div>
                    </th>
                  );
                })}
                <th scope="col" className="w-12 px-1.5">
                  <span className="sr-only">{t("table.actions")}</span>
                </th>
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
                : grid.getRowModel().rows.map((row, index, rows) => {
                    const record = row.original;
                    const label = rowLabel(record);
                    // A header row wherever a group starts, also atop each page.
                    const group = groupColumn && groupValueOf(groupColumn, record, records.data?.linked ?? {});
                    const startsGroup =
                      groupColumn !== undefined &&
                      (index === 0 ||
                        group !== groupValueOf(groupColumn, rows[index - 1].original, records.data?.linked ?? {}));
                    return (
                      <Fragment key={row.id}>
                        {startsGroup && (
                          <tr className="border-b border-border bg-muted/40">
                            <th
                              scope="colgroup"
                              colSpan={columns.length + 1}
                              className="px-3 py-2 text-left text-sm font-medium"
                            >
                              {t("group.header", {
                                column: groupColumn.name,
                                value:
                                  group === null
                                    ? t("group.empty")
                                    : groupColumn.type === "boolean"
                                      ? format(groupColumn, group === "true")
                                      : group,
                              })}{" "}
                              <span className="font-normal text-muted-foreground">
                                {t("group.count", {
                                  count:
                                    records.data?.groups.find(({ value }) => value === group)?.count ?? 0,
                                })}
                              </span>
                            </th>
                          </tr>
                        )}
                        <tr
                          key={row.id}
                          className={cn(
                            "group border-b border-border last:border-b-0 hover:bg-muted/30",
                            ticked.has(record.id) && "bg-primary/5",
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
                              <div className="flex items-center gap-1">
                              {index === 0 && canEdit && (
                                <input
                                  type="checkbox"
                                  aria-label={t("batch.select", { label })}
                                  className="mx-1.5 size-4 shrink-0 cursor-pointer accent-primary"
                                  checked={ticked.has(record.id)}
                                  onChange={() => toggle(record.id)}
                                />
                              )}
                              {/* On phones the fixed column must leave room for the cell being edited. */}
                              <div className={cn("min-w-0 flex-1", index === 0 && "max-w-36 sm:max-w-56 lg:max-w-none")}>
                                {column.type === "formula" ? (
                                  // Computed from the record's cells, never edited here (ADR-033).
                                  <ReadOnlyCell column={column} value={record.data[column.id]} format={format} />
                                ) : column.type === "lookup" || column.type === "rollup" ? (
                                  // Computed from other records, never edited here (ADR-030, ADR-031).
                                  column.id in table.lookupTargets || column.id in table.rollupTargets ? (
                                    <ReadOnlyCell
                                      column={shownColumn(table, column)}
                                      value={record.data[column.id]}
                                      format={format}
                                    />
                                  ) : (
                                    <span className="block h-8" />
                                  )
                                ) : canEdit ? (
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
                                <DropdownMenuItem onClick={() => showRecord(record.id)}>
                                  <FileText aria-hidden="true" />
                                  {t("qr.open")}
                                </DropdownMenuItem>
                                {stockColumns.length > 0 && (
                                  <DropdownMenuItem onClick={() => setDialog({ kind: "stock", record })}>
                                    <ArrowDownUp aria-hidden="true" />
                                    {t("table.stock")}
                                  </DropdownMenuItem>
                                )}
                                {canEdit && (
                                  <>
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
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      </Fragment>
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
        // Computed columns aren't filled by hand: the form leaves them out.
        columns={columns.filter(({ type }) => !isComputedType(type))}
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
      {dialog.kind === "stock" && dialog.record && stockColumns.length > 0 && (
        <StockDialog
          tableId={table.id}
          // The page's copy, so the stock shown follows every refetch.
          record={records.data?.data.find(({ id }) => id === dialog.record?.id) ?? dialog.record}
          label={rowLabel(dialog.record)}
          columns={stockColumns}
          canEdit={canEdit}
          onOpenChange={closeDialog}
        />
      )}
      {dialog.kind === "delete" && dialog.record && (
        <DeleteRecordDialog
          tableId={table.id}
          recordId={dialog.record.id}
          label={rowLabel(dialog.record)}
          onOpenChange={closeDialog}
        />
      )}
      {openRecord && (
        <RecordSheet
          table={table}
          recordId={openRecord}
          canEdit={canEdit}
          onClose={() => showRecord(null)}
          onEdit={
            canEdit
              ? (record) => {
                  showRecord(null);
                  setDialog({ kind: "edit", record });
                }
              : undefined
          }
          onStock={
            stockColumns.length > 0
              ? (record) => {
                  showRecord(null);
                  setDialog({ kind: "stock", record });
                }
              : undefined
          }
        />
      )}
      {canEdit && selection.length > 0 && (
        // Floating, so ticking a row never moves the table under the pointer.
        <div
          role="toolbar"
          aria-label={t("batch.toolbar")}
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-xl border border-border bg-popover p-3 shadow-lg sm:p-2 sm:pl-4"
        >
          <p role="status" className="basis-full text-sm font-medium sm:mr-auto sm:basis-auto">
            {t("batch.selected", { count: selection.length })}
          </p>
          <Button variant="outline" className="h-9" onClick={() => setDialog({ kind: "batchEdit" })}>
            <PenLine aria-hidden="true" />
            {t("batch.edit")}
          </Button>
          <Button
            variant="destructive"
            className="h-9"
            onClick={() => setDialog({ kind: "batchDelete" })}
          >
            <Trash2 aria-hidden="true" />
            {t("batch.delete")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={t("batch.clear")}
            onClick={clearSelection}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      )}
      {dialog.kind === "batchEdit" && (
        <BatchEditDialog
          tableId={table.id}
          columns={columns.filter(({ type }) => !isComputedType(type))}
          ids={selection}
          linked={records.data?.linked}
          onDone={() => {
            clearSelection();
            setDialog({ kind: null });
          }}
          onOpenChange={closeDialog}
        />
      )}
      {dialog.kind === "batchDelete" && (
        <BatchDeleteDialog
          tableId={table.id}
          ids={selection}
          onDone={() => {
            clearSelection();
            setDialog({ kind: null });
          }}
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
