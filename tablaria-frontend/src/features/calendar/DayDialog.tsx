import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CalendarEvent } from "./calendar-events";
import { formatDay } from "./calendar-dates";
import { EventChip } from "./EventChip";

/** Every record of a day that has more than the grid fits. */
export function DayDialog({
  day,
  events,
  labelOf,
  showColumn,
  onOpen,
  onClose,
}: {
  day: string;
  events: CalendarEvent[];
  labelOf: (event: CalendarEvent) => string;
  showColumn: boolean;
  onOpen: (event: CalendarEvent) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation(["calendar", "common"]);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t("common:close")} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="first-letter:uppercase">
            {t("dayDialog", { day: formatDay(day, i18n.language) })}
          </DialogTitle>
        </DialogHeader>
        <ul className="flex flex-col gap-1.5">
          {events.map((event) => (
            <li key={event.key}>
              <EventChip
                event={event}
                label={labelOf(event)}
                showColumn={showColumn}
                draggable={false}
                onOpen={(chosen) => {
                  onClose();
                  onOpen(chosen);
                }}
                className="min-h-10 px-3 text-sm"
              />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
