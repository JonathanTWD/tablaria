import {
  createColumnHelper,
  useTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, RotateCcw, Search, Table2 } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  columnType,
  demoTableFeatures,
  type DemoColumn,
  type DemoDataset,
  type DemoRow,
} from "./demo-table-features";
import { StockCell } from "./StockCell";

const columnHelper = createColumnHelper<typeof demoTableFeatures, DemoRow>();

function buildColumns(columns: DemoColumn[]) {
  // `columns()` keeps each accessor's value type inside the array.
  return columnHelper.columns(
    columns.map((column) => {
    const type = columnType(column);
    const isNumeric = type === "number" || type === "currency";
    return columnHelper.accessor((row) => row[column.id], {
      id: column.id,
      header: column.label,
      sortFn: isNumeric ? "basic" : "text",
      filterFn: "equalsString",
        enableGlobalFilter: type === "text" || type === "select",
      });
    }),
  );
}

interface DemoInventoryTableProps {
  dataset: DemoDataset;
  className?: string;
}

/**
 * Working, client-side inventory table for the landing page: search, filter,
 * sort and edit numbers without an account. Changes stay in memory.
 * Remount it (React `key`) to switch datasets.
 */
export function DemoInventoryTable({ dataset, className }: DemoInventoryTableProps) {
  const { t, i18n } = useTranslation("landing");
  const searchId = useId();
  const [rows, setRows] = useState(dataset.rows);
  const [edited, setEdited] = useState<ReadonlySet<string>>(new Set());
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columns] = useState(() => buildColumns(dataset.columns));

  const table = useTable({
    features: demoTableFeatures,
    columns,
    data: rows,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
  });

  const filterColumn = dataset.columns.find((column) => columnType(column) === "select");
  const filterOptions = filterColumn
    ? [...new Set(dataset.rows.map((row) => String(row[filterColumn.id])))]
    : [];
  const activeFilter = columnFilters.find((filter) => filter.id === filterColumn?.id)?.value;
  const visibleRows = table.getRowModel().rows;
  const isModified =
    edited.size > 0 || sorting.length > 0 || columnFilters.length > 0 || globalFilter !== "";

  const price = new Intl.NumberFormat(i18n.language, {
    style: "currency",
    currency: t("demo.currency"),
  });
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });

  const updateCell = (rowIndex: number, columnId: string, value: number) => {
    setRows((current) =>
      current.map((row, index) => (index === rowIndex ? { ...row, [columnId]: value } : row)),
    );
    setEdited((current) => new Set(current).add(`${rowIndex}:${columnId}`));
  };

  const reset = () => {
    setRows(dataset.rows);
    setEdited(new Set());
    setSorting([]);
    setColumnFilters([]);
    setGlobalFilter("");
  };

  const setCategory = (value: string | null) =>
    setColumnFilters(filterColumn && value ? [{ id: filterColumn.id, value }] : []);

  return (
    <div
      className={cn(
        "@container flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-[0_1px_0_rgb(21_22_58/0.04),0_24px_48px_-24px_rgb(21_22_58/0.25)]",
        className,
      )}
    >
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3 @2xl:flex-row @2xl:items-center">
        <p className="flex items-center gap-2 font-semibold tracking-tight">
          <Table2 aria-hidden="true" className="size-4 text-primary" />
          {dataset.name}
        </p>
        <div className="relative @2xl:ml-auto @2xl:w-64">
          <label htmlFor={searchId} className="sr-only">
            {t("demo.search")}
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={searchId}
            type="search"
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={t("demo.searchPlaceholder")}
            className="h-9 pl-8"
          />
        </div>
      </div>

      {filterColumn && (
        <div
          role="group"
          aria-label={t("demo.filterBy", { column: filterColumn.label })}
          className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border px-4 py-2.5"
        >
          {[null, ...filterOptions].map((option) => {
            const pressed = (activeFilter ?? null) === option;
            return (
              <button
                key={option ?? "all"}
                type="button"
                aria-pressed={pressed}
                onClick={() => setCategory(option)}
                className={cn(
                  "h-8 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  pressed
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-input hover:text-foreground",
                )}
              >
                {option ?? t("demo.all")}
              </button>
            );
          })}
        </div>
      )}

      {/* Scrolls on its own when the card is height-constrained (auth panel). */}
      <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{t("demo.label", { name: dataset.name })}</caption>
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-border bg-muted text-left">
            {table.getHeaderGroups()[0].headers.map((header) => {
              const column = dataset.columns.find((item) => item.id === header.column.id);
              const type = column ? columnType(column) : "text";
              const numeric = type === "number" || type === "currency";
              const sorted = header.column.getIsSorted();
              const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
              return (
                <th
                  key={header.id}
                  scope="col"
                  aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                  className={cn(
                    "px-1 py-1.5 font-medium @md:px-2",
                    numeric && "text-right",
                    column?.secondary && "hidden @xl:table-cell",
                  )}
                >
                  <button
                    type="button"
                    onClick={header.column.getToggleSortingHandler()}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                      numeric && "flex-row-reverse",
                      sorted && "text-foreground",
                    )}
                  >
                    {column?.label}
                    <SortIcon aria-hidden="true" className="size-3.5" />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-b-0">
              {row.getAllCells().map((cell, cellIndex) => {
                const column = dataset.columns[cellIndex];
                const type = columnType(column);
                const value = row.original[column.id];
                const isEdited = edited.has(`${row.index}:${column.id}`);
                const firstText = String(row.original[dataset.columns[0].id]);
                const cellClass = cn(
                  "px-3 py-2.5 @md:px-4",
                  column.secondary && "hidden @xl:table-cell",
                  (type === "number" || type === "currency") && "text-right tabular-nums whitespace-nowrap",
                );

                if (type === "number" && typeof value === "number") {
                  return (
                    <td key={cell.id} className={cn(cellClass, "py-1.5")}>
                      <StockCell
                        value={value}
                        lowStock={column.stock ? dataset.lowStock : undefined}
                        edited={isEdited}
                        label={t("demo.edit", { column: column.label, row: firstText })}
                        onChange={(next) => updateCell(row.index, column.id, next)}
                      />
                    </td>
                  );
                }

                const content =
                  type === "currency" && typeof value === "number"
                    ? price.format(value)
                    : type === "date"
                      ? date.format(new Date(`${value}T00:00:00`))
                      : String(value);

                if (cellIndex === 0) {
                  return (
                    <th key={cell.id} scope="row" className={cn(cellClass, "text-left font-medium")}>
                      {content}
                    </th>
                  );
                }
                return (
                  <td key={cell.id} className={cellClass}>
                    {type === "select" ? (
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs whitespace-nowrap text-secondary-foreground">
                        {content}
                      </span>
                    ) : (
                      content
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {visibleRows.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t("demo.noResults", { query: globalFilter || activeFilter })}
        </p>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
        <p aria-live="polite" className="tabular-nums">
          {t("demo.results", { count: visibleRows.length, total: rows.length })}
        </p>
        <p className="hidden @lg:block">{t("demo.hint")}</p>
        {isModified && (
          <button
            type="button"
            onClick={reset}
            className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md px-2 font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            {t("demo.reset")}
          </button>
        )}
      </div>
    </div>
  );
}
