import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  PresenceCell,
  PresenceViewer,
  RealtimeClientMessage,
  RealtimeScope,
  RealtimeServerMessage,
  RealtimeTicket,
} from "@tablaria/shared";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { stockAlertsQuery } from "@/features/stock-alerts/queries";
import { tableKeys } from "@/features/tables/queries";
import { apiRequest } from "@/lib/api-client";
import { RealtimeContext, type RealtimeStatus } from "./realtime-context";

/** Seconds between reconnection attempts; the last one repeats. */
const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

/** Refetches what a change covers; the API decides what the user may see. */
function refresh(queryClient: QueryClient, tableId: string, scope: RealtimeScope) {
  const keys: (readonly unknown[])[] = [];
  if (scope === "records" || scope === "columns") {
    keys.push(
      tableKeys.records(tableId),
      tableKeys.metrics(tableId),
      tableKeys.movements(tableId),
      tableKeys.activity(tableId),
      stockAlertsQuery.queryKey,
    );
  }
  if (scope === "records" || scope === "columns" || scope === "table") {
    // Counts and "last edited" live on the table and in the lists.
    keys.push(tableKeys.detail(tableId), tableKeys.list(), tableKeys.shared());
  }
  if (scope === "sharing") {
    keys.push(tableKeys.sharing(tableId));
  }
  if (scope === "deleted") {
    // The page refetches, gets a 404 and says the table is gone.
    keys.push(tableKeys.detail(tableId), tableKeys.list(), tableKeys.shared(), stockAlertsQuery.queryKey);
  }
  for (const queryKey of keys) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

function socketUrl(ticket: RealtimeTicket): string {
  if (ticket.url) {
    return ticket.url;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/realtime`;
}

/**
 * One WebSocket per signed-in tab, telling the app when tables it shows change
 * (ADR-020). Reconnects on its own and catches up by refetching.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  /** Table id → how many components want it. */
  const wantedRef = useRef(new Map<string, number>());
  /** Table id → the cell this tab is editing, re-sent after reconnecting. */
  const editingRef = useRef(new Map<string, PresenceCell>());
  const [presence, setPresence] = useState<ReadonlyMap<string, PresenceViewer[]>>(new Map());

  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const send = (message: RealtimeClientMessage) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(message));
      }
    };

    const scheduleRetry = () => {
      if (stopped) {
        return;
      }
      setStatus("offline");
      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
      attempt += 1;
      retryTimer = setTimeout(() => void connect(), delay);
    };

    const connect = async () => {
      let ticket: RealtimeTicket;
      try {
        ticket = await apiRequest<RealtimeTicket>("/realtime/ticket", { method: "POST" });
      } catch {
        // Server asleep or session gone: try again later (the session guard handles logouts).
        scheduleRetry();
        return;
      }
      if (stopped) {
        return;
      }
      const socket = new WebSocket(socketUrl(ticket));
      socketRef.current = socket;
      socket.onopen = () => socket.send(JSON.stringify({ type: "auth", ticket: ticket.ticket }));
      socket.onmessage = (event: MessageEvent<string>) => {
        const message = JSON.parse(event.data) as RealtimeServerMessage;
        if (message.type === "ready") {
          const reconnected = attempt > 0;
          attempt = 0;
          setStatus("live");
          for (const tableId of wantedRef.current.keys()) {
            send({ type: "subscribe", tableId });
            const cell = editingRef.current.get(tableId);
            if (cell) {
              send({ type: "editing", tableId, cell });
            }
            // Changes made while offline were missed: refetch everything shown.
            if (reconnected) {
              refresh(queryClient, tableId, "columns");
              refresh(queryClient, tableId, "sharing");
            }
          }
        } else if (message.type === "changed") {
          refresh(queryClient, message.tableId, message.scope);
        } else if (message.type === "revoked") {
          refresh(queryClient, message.tableId, "deleted");
        } else if (message.type === "presence") {
          setPresence((current) => new Map(current).set(message.tableId, message.viewers));
        }
      };
      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        // Who's there is unknown while offline; it comes back with the reconnection.
        setPresence(new Map());
        scheduleRetry();
      };
    };

    void connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [queryClient]);

  // Stable, so subscribers don't resubscribe whenever the status changes.
  const subscribe = useCallback((tableId: string) => {
    const wanted = wantedRef.current;
    const count = wanted.get(tableId) ?? 0;
    wanted.set(tableId, count + 1);
    const message = (type: "subscribe" | "unsubscribe") => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type, tableId }));
      }
    };
    if (count === 0) {
      message("subscribe");
    }
    return () => {
      const remaining = (wanted.get(tableId) ?? 1) - 1;
      if (remaining > 0) {
        wanted.set(tableId, remaining);
        return;
      }
      wanted.delete(tableId);
      editingRef.current.delete(tableId);
      message("unsubscribe");
      setPresence((current) => {
        const next = new Map(current);
        next.delete(tableId);
        return next;
      });
    };
  }, []);

  const setEditing = useCallback((tableId: string, cell: PresenceCell | null) => {
    if (cell) {
      editingRef.current.set(tableId, cell);
    } else {
      editingRef.current.delete(tableId);
    }
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "editing", tableId, cell }));
    }
  }, []);

  return (
    <RealtimeContext.Provider value={{ status, presence, subscribe, setEditing }}>
      {children}
    </RealtimeContext.Provider>
  );
}
