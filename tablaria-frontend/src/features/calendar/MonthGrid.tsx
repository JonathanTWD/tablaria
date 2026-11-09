import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./calendar-events";
import { dayNumber, formatDay, monthOf, weekdayNames } from "./calendar-dates";
import { DRAG_TYPE, type DraggedEvent, EventChip } from "./EventChip";

/** Events a day shows before "+N more". */
const VISIBLE_EVENTS = 3;

/** A month as a grid of weeks, for wide screens; phones get the agenda. */
export function MonthGrid({
  month,
  days,
  today,
  events,
  labelOf,
  showColumn,
  canDrag,
  onOpen,
  onMore,
  onDrop,
}: {
  month: string;
  days: string[];
  today: string;
  events: Map<string, CalendarEvent[]>;
  labelOf: (event: CalendarEvent) => string;
  showColumn: boolean;
  canDrag: boolean;
  onOpen: (event: CalendarEvent) => void;
  onMore: (day: string) => void;
  onDrop: (dragged: DraggedEvent, day: string) => void;
}) {
  const { t, i18n } = useTranslation("calendar");
  const [target, setTarget] = useState<string | null>(null);
  const short = weekdayNames(i18n.language);

  return (
    <div className="hidden overflow-hidden rounded-xl border border-border md:block">
      <div aria-hidden="true" className="grid grid-cols-7 border-b border-border bg-muted/40">
        {short.map((name) => (
          <div key={name} className="px-2 py-2 text-xs font-medium text-muted-foreground capitalize">
            {name}
          </div>
        ))}
      </div>
      <ol className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = events.get(day) ?? [];
          const hidden = dayEvents.length - VISIBLE_EVENTS;
          const outside = monthOf(day) !== month;
          const isToday = day === today;
          return (
            <li
              key={day}
              onDragOver={(dragEvent) => {
                if (canDrag && dragEvent.dataTransfer.types.includes(DRAG_TYPE)) {
                  dragEvent.preventDefault();
                  dragEvent.dataTransfer.dropEffect = "move";
                  setTarget(day);
                }
              }}
              onDragLeave={() => setTarget((current) => (current === day ? null : current))}
              onDrop={(dragEvent) => {
                setTarget(null);
                const raw = dragEvent.dataTransfer.getData(DRAG_TYPE);
                if (!raw) {
                  return;
                }
                dragEvent.preventDefault();
                const dragged = JSON.parse(raw) as DraggedEvent;
                if (dragged.day !== day) {
                  onDrop(dragged, day);
                }
              }}
              className={cn(
                "flex min-h-28 min-w-0 flex-col gap-1 border-border p-1.5 transition-colors",
                index % 7 !== 6 && "border-r",
                index < days.length - 7 && "border-b",
                outside && "bg-muted/30",
                target === day && "bg-primary/10 ring-2 ring-primary ring-inset",
              )}
            >
              <div className="flex items-center justify-between px-0.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                    outside ? "text-muted-foreground" : "font-medium",
                    isToday && "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {dayNumber(day)}
                </span>
                <span className="sr-only">
                  {formatDay(day, i18n.language)}
                  {isToday && ` (${t("todayLabel")})`}
                  {dayEvents.length > 0 && `, ${t("events", { count: dayEvents.length })}`}
                </span>
              </div>
              {dayEvents.slice(0, VISIBLE_EVENTS).map((event) => (
                <EventChip
                  key={event.key}
                  event={event}
                  label={labelOf(event)}
                  showColumn={showColumn}
                  draggable={canDrag}
                  onOpen={onOpen}
                />
              ))}
              {hidden > 0 && (
                <button
                  type="button"
                  onClick={() => onMore(day)}
                  className="self-start rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {t("more", { count: hidden })}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
