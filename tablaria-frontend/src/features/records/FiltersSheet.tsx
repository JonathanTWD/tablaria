import type { RecordFilter, TableColumn } from "@tablaria/shared";
import { SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { fromDraft } from "./cell-draft";

/** Editable text for each column's filter. */
interface FilterDraft {
  value: string;
  min: string;
  max: string;
  is: "" | "true" | "false";
  values: string[];
}

const EMPTY_DRAFT: FilterDraft = { value: "", min: "", max: "", is: "", values: [] };

function toDrafts(filters: RecordFilter[]): Record<string, FilterDraft> {
  return Object.fromEntries(
    filters.map((filter) => {
      switch (filter.op) {
        case "contains":
          return [filter.columnId, { ...EMPTY_DRAFT, value: filter.value }];
        case "between":
          return [
            filter.columnId,
            { ...EMPTY_DRAFT, min: String(filter.min ?? ""), max: String(filter.max ?? "") },
          ];
        case "is":
          return [filter.columnId, { ...EMPTY_DRAFT, is: filter.value ? "true" : "false" }];
        case "in":
          return [filter.columnId, { ...EMPTY_DRAFT, values: filter.values }];
      }
    }),
  );
}

/** The filter a draft describes, or null when it filters nothing. */
function toFilter(column: TableColumn, draft: FilterDraft): RecordFilter | null {
  const columnId = column.id;
  switch (column.type) {
    case "text":
      return draft.value.trim() ? { columnId, op: "contains", value: draft.value.trim() } : null;
    case "boolean":
      return draft.is ? { columnId, op: "is", value: draft.is === "true" } : null;
    case "select":
      return draft.values.length > 0 ? { columnId, op: "in", values: draft.values } : null;
    default: {
      // Unparseable numbers are ignored rather than sent.
      const bound = (text: string): number | string | undefined => {
        const value = fromDraft(column, text);
        return typeof value === "string" || (typeof value === "number" && !Number.isNaN(value))
          ? value
          : undefined;
      };
      const min = bound(draft.min);
      const max = bound(draft.max);
      return min === undefined && max === undefined
        ? null
        : { columnId, op: "between", min, max };
    }
  }
}

interface FiltersSheetProps {
  columns: TableColumn[];
  filters: RecordFilter[];
  onApply: (filters: RecordFilter[]) => void;
}

export function FiltersSheet({ columns, filters, onApply }: FiltersSheetProps) {
  const { t } = useTranslation(["records", "common"]);
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, FilterDraft>>({});

  const changeOpen = (next: boolean) => {
    // Every opening starts from the filters currently applied.
    if (next) {
      setDrafts(toDrafts(filters));
    }
    setOpen(next);
  };

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    onApply(
      columns.flatMap((column) => {
        const filter = toFilter(column, drafts[column.id] ?? EMPTY_DRAFT);
        return filter ? [filter] : [];
      }),
    );
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetTrigger render={<Button variant="outline" className="h-9" />}>
        <SlidersHorizontal aria-hidden="true" />
        {filters.length > 0
          ? t("toolbar.filtersActive", { count: filters.length })
          : t("toolbar.filters")}
      </SheetTrigger>
      <SheetContent side="right" closeLabel={t("common:close")} className="w-full sm:max-w-sm">
        <form onSubmit={apply} noValidate className="flex h-full flex-col">
          <div className="border-b border-border p-4">
            <SheetTitle>{t("filters.title")}</SheetTitle>
            <SheetDescription>{t("filters.description")}</SheetDescription>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {/* Relations would filter by record ids: not offered until it can be by name. */}
            {columns
              .filter((column) => column.type !== "relation")
              .map((column) => (
                <ColumnFilter
                  key={column.id}
                  column={column}
                  draft={drafts[column.id] ?? EMPTY_DRAFT}
                  onChange={(draft) => setDrafts((current) => ({ ...current, [column.id]: draft }))}
                />
              ))}
          </div>
          <div className="flex gap-2 border-t border-border p-4">
            <Button type="button" variant="outline" className="h-9 flex-1" onClick={() => setDrafts({})}>
              {t("filters.clear")}
            </Button>
            <Button type="submit" className="h-9 flex-1">
              {t("filters.apply")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ColumnFilter({
  column,
  draft,
  onChange,
}: {
  column: TableColumn;
  draft: FilterDraft;
  onChange: (draft: FilterDraft) => void;
}) {
  const { t } = useTranslation("records");
  const id = useId();
  const set = (patch: Partial<FilterDraft>) => onChange({ ...draft, ...patch });

  if (column.type === "text") {
    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          {column.name} <span className="font-normal text-muted-foreground">· {t("filters.contains")}</span>
        </label>
        <Input id={id} value={draft.value} onChange={(event) => set({ value: event.target.value })} className="h-9" />
      </div>
    );
  }

  if (column.type === "boolean") {
    const options = [
      ["", t("filters.any")],
      ["true", t("filters.yes")],
      ["false", t("filters.no")],
    ] as const;
    return (
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{column.name}</legend>
        <div className="flex gap-1.5">
          {options.map(([value, text]) => (
            <label
              key={value}
              className="flex h-8 cursor-pointer items-center rounded-full border border-border px-3 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
            >
              <input
                type="radio"
                name={id}
                value={value}
                checked={draft.is === value}
                onChange={() => set({ is: value })}
                className="sr-only"
              />
              {text}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (column.type === "select") {
    return (
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{column.name}</legend>
        <div className="flex flex-wrap gap-1.5">
          {column.options.choices.map((choice) => (
            <label
              key={choice.id}
              className="flex h-8 cursor-pointer items-center rounded-full border border-border px-3 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
            >
              <input
                type="checkbox"
                checked={draft.values.includes(choice.label)}
                onChange={(event) =>
                  set({
                    values: event.target.checked
                      ? [...draft.values, choice.label]
                      : draft.values.filter((label) => label !== choice.label),
                  })
                }
                className="sr-only"
              />
              {choice.label}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  const isDate = column.type === "date";
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{column.name}</legend>
      <div className="grid grid-cols-2 gap-2">
        {(["min", "max"] as const).map((bound) => (
          <div key={bound} className="space-y-1">
            <label htmlFor={`${id}-${bound}`} className="text-xs text-muted-foreground">
              {t(`filters.${bound}`)}
            </label>
            <Input
              id={`${id}-${bound}`}
              type={isDate ? "date" : "text"}
              inputMode={isDate ? undefined : "decimal"}
              value={draft[bound]}
              onChange={(event) => set({ [bound]: event.target.value })}
              className="h-9"
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}
