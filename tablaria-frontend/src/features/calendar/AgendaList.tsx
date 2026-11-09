import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./calendar-events";
import { formatDay } from "./calendar-dates";
import { EventChip } from "./EventChip";

/** The month's days that have records, one under another: the calendar on phones. */
export function AgendaList({
  days,
  today,
  events,
  labelOf,
  showColumn,
  onOpen,
}: {
  /** The days of the month itself, in order. */
  days: string[];
  today: string;
  events: Map<string, CalendarEvent[]>;
  labelOf: (event: CalendarEvent) => string;
  showColumn: boolean;
  onOpen: (event: CalendarEvent) => void;
}) {
  const { t, i18n } = useTranslation("calendar");
  const busy = days.filter((day) => events.has(day));

  return (
    <ol className="flex flex-col gap-5 md:hidden">
      {busy.map((day) => (
        <li key={day}>
          <h3
            className={cn(
              "text-sm font-semibold first-letter:uppercase",
              day === today && "text-primary",
            )}
          >
            {formatDay(day, i18n.language)}
            {day === today && ` · ${t("todayLabel")}`}
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {(events.get(day) ?? []).map((event) => (
              <li key={event.key}>
                <EventChip
                  event={event}
                  label={labelOf(event)}
                  showColumn={showColumn}
                  draggable={false}
                  onOpen={onOpen}
                  className="min-h-11 px-3 text-sm"
                />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
