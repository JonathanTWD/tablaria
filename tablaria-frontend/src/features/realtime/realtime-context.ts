import type { PresenceCell, PresenceViewer } from "@tablaria/shared";
import { createContext, useCallback, useContext, useEffect } from "react";

export type RealtimeStatus = "connecting" | "live" | "offline";

interface RealtimeContextValue {
  status: RealtimeStatus;
  /** Table id → people with it open, the current user included. */
  presence: ReadonlyMap<string, PresenceViewer[]>;
  /** Listens to a table until the returned function is called. */
  subscribe: (tableId: string) => () => void;
  /** Tells the others which cell of the table this tab is editing (null: none). */
  setEditing: (tableId: string, cell: PresenceCell | null) => void;
}

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/**
 * Outside a RealtimeProvider (tests, screens without a session) tables still
 * work, just without live updates or presence.
 */
const OFFLINE: RealtimeContextValue = {
  status: "connecting",
  presence: new Map(),
  subscribe: () => () => undefined,
  setEditing: () => undefined,
};

function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext) ?? OFFLINE;
}

/** Keeps the table's data current while the component is mounted. */
export function useRealtimeTable(tableId: string): RealtimeStatus {
  const { subscribe, status } = useRealtime();
  // Subscribing to an external system is what effects are for.
  useEffect(() => subscribe(tableId), [subscribe, tableId]);
  return status;
}

const NO_VIEWERS: PresenceViewer[] = [];

/** People with the table open and what they're editing, the current user included. */
export function useTablePresence(tableId: string): {
  viewers: PresenceViewer[];
  setEditing: (cell: PresenceCell | null) => void;
} {
  const { presence, setEditing } = useRealtime();
  // Stable, so cells can depend on it in effects.
  const setTableEditing = useCallback(
    (cell: PresenceCell | null) => setEditing(tableId, cell),
    [setEditing, tableId],
  );
  return { viewers: presence.get(tableId) ?? NO_VIEWERS, setEditing: setTableEditing };
}
