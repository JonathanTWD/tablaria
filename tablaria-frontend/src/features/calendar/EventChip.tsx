import { SELECT_SWATCH_CLASSES } from "@/features/columns/column-ui";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./calendar-events";

/** What a dragged event carries to the day it's dropped on. */
export const DRAG_TYPE = "application/x-tablaria-event";

export interface DraggedEvent {
  recordId: string;
  columnId: string;
  day: string;
}

/** A record on a day: its name, the date column when several show, and its color. */
export function EventChip({
  event,
  label,
  showColumn,
  draggable,
  onOpen,
  className,
}: {
  event: CalendarEvent;
  label: string;
  showColumn: boolean;
  draggable: boolean;
  onOpen: (event: CalendarEvent) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      draggable={draggable}
      // The full name when a narrow day cuts it short.
      title={showColumn ? `${label} · ${event.column.name}` : label}
      onDragStart={(dragEvent) => {
        const payload: DraggedEvent = {
          recordId: event.record.id,
          columnId: event.column.id,
          day: event.day,
        };
        dragEvent.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
        dragEvent.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(event)}
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded-md border border-border bg-card px-1.5 py-1 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
        draggable && "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          event.color ? SELECT_SWATCH_CLASSES[event.color] : "bg-muted-foreground/40",
        )}
      />
      <span className="min-w-0 truncate font-medium">{label}</span>{" "}
      {showColumn && (
        // The column gives way first: the record's name matters more.
        <span className="min-w-0 shrink-[4] truncate text-muted-foreground">· {event.column.name}</span>
      )}
      {event.colorLabel && <span className="sr-only">, {event.colorLabel}</span>}
    </button>
  );
}
