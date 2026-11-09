import type { TableColumn } from "@tablaria/shared";
import { CalendarDays, ChevronLeft, ChevronRight, Palette } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMonth } from "./calendar-dates";

export const ALL_DATES = "all";
export const NO_COLOR = "none";

/** Month navigation, and which dates and colors the calendar shows. */
export function CalendarToolbar({
  month,
  isCurrentMonth,
  onMonth,
  onToday,
  dateColumns,
  dates,
  onDates,
  selectColumns,
  color,
  onColor,
}: {
  month: string;
  isCurrentMonth: boolean;
  onMonth: (step: -1 | 1) => void;
  onToday: () => void;
  dateColumns: TableColumn[];
  /** A date column's id, or ALL_DATES. */
  dates: string;
  onDates: (value: string) => void;
  selectColumns: TableColumn[];
  /** A select column's id, or NO_COLOR. */
  color: string;
  onColor: (value: string) => void;
}) {
  const { t, i18n } = useTranslation("calendar");
  const datesId = useId();
  const colorId = useId();
  const dateItems = {
    [ALL_DATES]: t("dates.all"),
    ...Object.fromEntries(dateColumns.map((column) => [column.id, column.name])),
  };
  const colorItems = {
    [NO_COLOR]: t("color.none"),
    ...Object.fromEntries(selectColumns.map((column) => [column.id, t("color.by", { column: column.name })])),
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label={t("previous")} onClick={() => onMonth(-1)}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button variant="outline" size="icon" aria-label={t("next")} onClick={() => onMonth(1)}>
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button variant="outline" className="h-9" disabled={isCurrentMonth} onClick={onToday}>
          {t("today")}
        </Button>
        <h2 aria-live="polite" className="ml-1 text-lg font-semibold tracking-tight first-letter:uppercase">
          {formatMonth(month, i18n.language)}
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {dateColumns.length > 1 && (
          <>
            <label htmlFor={datesId} className="sr-only">
              {t("dates.label")}
            </label>
            <Select items={dateItems} value={dates} onValueChange={(next) => next && onDates(next)}>
              <SelectTrigger id={datesId} className="h-9 w-auto min-w-40">
                <CalendarDays aria-hidden="true" className="text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(dateItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        {selectColumns.length > 0 && (
          <>
            <label htmlFor={colorId} className="sr-only">
              {t("color.label")}
            </label>
            <Select items={colorItems} value={color} onValueChange={(next) => next && onColor(next)}>
              <SelectTrigger id={colorId} className="h-9 w-auto min-w-40">
                <Palette aria-hidden="true" className="text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(colorItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
    </div>
  );
}
