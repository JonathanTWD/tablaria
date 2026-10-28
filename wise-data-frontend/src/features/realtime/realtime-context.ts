import { createContext, useContext, useEffect } from "react";

export type RealtimeStatus = "connecting" | "live" | "offline";

interface RealtimeContextValue {
  status: RealtimeStatus;
  /** Listens to a table until the returned function is called. */
  subscribe: (tableId: string) => () => void;
}

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/** Keeps the table's data current while the component is mounted. */
export function useRealtimeTable(tableId: string): RealtimeStatus {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtimeTable must be used within a RealtimeProvider");
  }
  const { subscribe, status } = context;
  // Subscribing to an external system is what effects are for.
  useEffect(() => subscribe(tableId), [subscribe, tableId]);
  return status;
}
