import { useQuery } from "@tanstack/react-query";
import { hasRole, isComputedType, type TableDetail } from "@tablaria/shared";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useOutletContext, useSearchParams } from "react-router";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Skeleton } from "@/components/ui/skeleton";
import { AgendaList } from "@/features/calendar/AgendaList";
import {
  addMonths,
  formatDay,
  formatMonth,
  monthGrid,
  monthOf,
  parseMonth,
  todayIso,
} from "@/features/calendar/calendar-dates";
import { type CalendarEvent, eventsByDay } from "@/features/calendar/calendar-events";
import { ALL_DATES, CalendarToolbar, NO_COLOR } from "@/features/calendar/CalendarToolbar";
import { DayDialog } from "@/features/calendar/DayDialog";
import type { DraggedEvent } from "@/features/calendar/EventChip";
import { MonthGrid } from "@/features/calendar/MonthGrid";
import { calendarRecordsQuery } from "@/features/calendar/queries";
import { SELECT_SWATCH_CLASSES } from "@/features/columns/column-ui";
import { useCellFormatter } from "@/features/columns/format-value";
import { RecordDialog } from "@/features/records/RecordDialog";
import { RecordSheet } from "@/features/records/RecordSheet";
import { useUpdateRecord } from "@/features/records/queries";
import { apiErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";

/**
 * The table's records on a calendar, by their date columns. What it shows
 * lives in the URL (month, dates, color), like the records view.
 */
export default function CalendarPage() {
  const { t, i18n } = useTranslation(["calendar", "records"]);
  const table = useOutletContext<TableDetail>();
  const [params, setParams] = useSearchParams();
  const format = useCellFormatter();
  const update = useUpdateRecord(table.id);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const canEdit = hasRole(table.role, "EDITOR");
  const dateColumns = table.columns.filter((column) => column.type === "date");
  const selectColumns = table.columns.filter((column) => column.type === "select");

  const today = todayIso();
  const month = parseMonth(params.get("month")) ?? monthOf(today);
  const datesParam = params.get("dates");
  const shownDates = dateColumns.filter((column) => !datesParam || column.id === datesParam);
  const dates = shownDates.length === 1 && dateColumns.length > 1 ? shownDates[0].id : ALL_DATES;
  const colorParam = params.get("color");
  // The first select colors the records until the user picks another, or none.
  const colorColumn =
    colorParam === NO_COLOR
      ? undefined
      : (selectColumns.find((column) => column.id === colorParam) ?? selectColumns[0]);

  const days = monthGrid(month);
  const from = days[0];
  const to = days[days.length - 1];
  const records = useQuery({
    ...calendarRecordsQuery(
      table.id,
      (shownDates.length > 0 ? shownDates : dateColumns).map(({ id }) => id),
      from,
      to,
    ),
    enabled: dateColumns.length > 0,
  });

  const setParam = (key: string, value: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      return next;
    });

  if (dateColumns.length === 0) {
    return <NoDateColumns table={table} />;
  }

  const shown = shownDates.length > 0 ? shownDates : dateColumns;
  const events = eventsByDay(records.data?.data ?? [], shown, colorColumn, from, to);
  const monthDays = days.filter((day) => monthOf(day) === month);
  const monthIsEmpty = monthDays.every((day) => !events.has(day));
  const firstColumn = table.columns[0];
  const labelOf = (event: CalendarEvent) =>
    format(firstColumn, event.record.data[firstColumn.id]) || t("records:table.untitled");
  const showColumn = shown.length > 1;
  const openEvent = (event: CalendarEvent) => setRecordOpen(event.record.id);
  const editingRecord = editing ? records.data?.data.find(({ id }) => id === editing) : undefined;

  const move = ({ recordId, columnId }: DraggedEvent, day: string) => {
    const record = records.data?.data.find(({ id }) => id === recordId);
    const column = dateColumns.find(({ id }) => id === columnId);
    if (!record || !column) {
      return;
    }
    const name = format(firstColumn, record.data[firstColumn.id]) || t("records:table.untitled");
    update.mutate(
      { recordId, changes: { [columnId]: day } },
      {
        onSuccess: () =>
          toast.success(t("moved", { record: name, column: column.name, day: formatDay(day, i18n.language) })),
        onError: (error) => toast.error(t("moveError", { message: apiErrorMessage(error) })),
      },
    );
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      <title>{`${t("tab")} · ${table.name} | Tablaria`}</title>
      <CalendarToolbar
        month={month}
        isCurrentMonth={month === monthOf(today)}
        onMonth={(step) => setParam("month", addMonths(month, step))}
        onToday={() => setParam("month", null)}
        dateColumns={dateColumns}
        dates={dates}
        onDates={(value) => setParam("dates", value === ALL_DATES ? null : value)}
        selectColumns={selectColumns}
        color={colorColumn?.id ?? NO_COLOR}
        onColor={(value) => setParam("color", value === selectColumns[0]?.id ? null : value)}
      />

      {colorColumn?.type === "select" && (
        <ul aria-label={t("color.label")} className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {colorColumn.options.choices.map((choice) => (
            <li key={choice.id} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn("size-2 rounded-full", SELECT_SWATCH_CLASSES[choice.color])} />
              {choice.label}
            </li>
          ))}
        </ul>
      )}

      {records.isError ? (
        <FormAlert>
          {t("loadError")}{" "}
          <Button variant="link" className="h-auto p-0" onClick={() => void records.refetch()}>
            {t("retry")}
          </Button>
        </FormAlert>
      ) : records.isPending ? (
        <Skeleton className="h-[36rem] w-full rounded-xl" />
      ) : (
        <div aria-busy={records.isPlaceholderData} className={cn(records.isPlaceholderData && "opacity-60")}>
          {records.data.truncated && (
            <div className="mb-4">
              <FormAlert>{t("truncated")}</FormAlert>
            </div>
          )}
          <MonthGrid
            month={month}
            days={days}
            today={today}
            events={events}
            labelOf={labelOf}
            showColumn={showColumn}
            canDrag={canEdit}
            onOpen={openEvent}
            onMore={setDayOpen}
            onDrop={move}
          />
          <AgendaList
            days={monthDays}
            today={today}
            events={events}
            labelOf={labelOf}
            showColumn={showColumn}
            onOpen={openEvent}
          />
          {monthIsEmpty && (
            <p className="mt-4 rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
              {t("emptyMonth", { month: formatMonth(month, i18n.language) })} {t("emptyMonthHint")}
            </p>
          )}
          {canEdit && !monthIsEmpty && (
            <p className="mt-3 hidden text-xs text-muted-foreground md:block">{t("dragHint")}</p>
          )}
        </div>
      )}

      {dayOpen && (
        <DayDialog
          day={dayOpen}
          events={events.get(dayOpen) ?? []}
          labelOf={labelOf}
          showColumn={showColumn}
          onOpen={openEvent}
          onClose={() => setDayOpen(null)}
        />
      )}
      {recordOpen && (
        <RecordSheet
          table={table}
          recordId={recordOpen}
          canEdit={canEdit}
          onClose={() => setRecordOpen(null)}
          onEdit={
            canEdit
              ? (record) => {
                  setRecordOpen(null);
                  setEditing(record.id);
                }
              : undefined
          }
        />
      )}
      <RecordDialog
        tableId={table.id}
        columns={table.columns.filter(({ type }) => !isComputedType(type))}
        linked={records.data?.linked}
        record={editingRecord}
        open={editingRecord !== undefined}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  );
}

function NoDateColumns({ table }: { table: TableDetail }) {
  const { t } = useTranslation("calendar");
  return (
    <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <title>{`${t("tab")} · ${table.name} | Tablaria`}</title>
      <CalendarDays aria-hidden="true" className="size-8 text-muted-foreground" />
      <h2 className="mt-3 font-semibold">{t("noDates.title")}</h2>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">{t("noDates.description")}</p>
      {hasRole(table.role, "ADMIN") && (
        <Link to="../columns" relative="path" className={cn(buttonVariants(), "mt-5 h-9")}>
          {t("noDates.action")}
        </Link>
      )}
    </div>
  );
}
