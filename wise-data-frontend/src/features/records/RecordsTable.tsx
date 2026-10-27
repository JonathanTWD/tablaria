import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import type { RecordFilter, TableColumn, TableDetail, TableRecord } from "@wisedata/shared";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ellipsis,
  Pencil,
  Plus,
  Rows3,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
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
import { EditableCell } from "./EditableCell";
import { FiltersSheet } from "./FiltersSheet";
import { RecordDialog } from "./RecordDialog";
import { RecordsPagination } from "./RecordsPagination";
import { recordsQuery, useUpdateRecord } from "./queries";
import { useRecordsView } from "./records-view";

// Sorting runs on the server; TanStack Table only tracks which header is active.
const recordTableFeatures = tableFeatures({ rowSortingFeature });
const columnHelper = createColumnHelper<typeof recordTableFeatures, TableRecord>();

const SEARCH_DEBOUNCE_MS = 300;

interface DialogState {
  kind: "create" | "edit" | "delete" | null;
  record?: TableRecord;
}

export function RecordsTable({ table }: { table: TableDetail }) {
  const { t } = useTranslation("records");
  const [view, setView] = useRecordsView();
  const records = useQuery(recordsQuery(table.id, view));
  const update = useUpdateRecord(table.id);
  const format = useCellFormatter();
  const [dialog, setDialog] = useState<DialogState>({ kind: null });
  const { columns } = table;

  const sorting: SortingState = view.sort ? [{ id: view.sort, desc: view.order === "desc" }] : [];
  const onSortingChange = (updater: Updater<SortingState>) => {
    const [next] = typeof updater === "function" ? updater(sorting) : updater;
    setView({ sort: next?.id, order: next?.desc ? "desc" : "asc" });
  };

  const tableColumns = useMemo(
    () =>
      columnHelper.columns(
        columns.map((column) =>
          columnHelper.accessor((record) => record.data[column.id], { id: column.id }),
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

  if (columns.length === 0) {
    return (
      <EmptyState
        title={t("empty.noColumnsTitle")}
        description={t("empty.noColumnsDescription")}
        action={
          <Link to="columns" className={cn(buttonVariants(), "h-9")}>
            {t("empty.noColumnsAction")}
          </Link>
        }
      />
    );
  }

  return (
    <section aria-label={t("tabs.records")} className="mt-6">
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
        <Button className="h-9 sm:ml-auto" onClick={() => setDialog({ kind: "create" })}>
          <Plus aria-hidden="true" />
          {t("toolbar.add")}
        </Button>
      </div>

      {view.filters.length > 0 && (
        <FilterChips
          columns={columns}
          filters={view.filters}
          format={format}
          onRemove={(filter) => setView({ filters: view.filters.filter((item) => item !== filter) })}
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
                      className={cn("px-1.5 py-1.5 font-medium whitespace-nowrap", numeric && "text-right")}
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
                : grid.getRowModel().rows.map((row) => {
                    const record = row.original;
                    const label = rowLabel(record);
                    return (
                      <tr key={row.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                        {columns.map((column) => (
                          <td key={column.id} className="px-1.5 py-1 align-middle">
                            <EditableCell
                              column={column}
                              value={record.data[column.id]}
                              label={t("cell.label", { column: column.name, row: label })}
                              format={format}
                              onSave={(value) => save(record, column, value)}
                            />
                          </td>
                        ))}
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
        record={dialog.kind === "create" ? undefined : dialog.record}
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
    </section>
  );
}

/** Updates the URL once the user pauses typing, not on every key. */
function SearchField({ initial, onSearch }: { initial: string; onSearch: (search: string) => void }) {
  const { t } = useTranslation("records");
  const id = useId();
  const [value, setValue] = useState(initial);
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
  onRemove: (filter: RecordFilter) => void;
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
              onClick={() => onRemove(filter)}
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
