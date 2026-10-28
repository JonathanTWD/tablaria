import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tableKeys } from "@/features/tables/queries";
import { mockApi } from "@/test/render";
import { useRealtimeTable } from "./realtime-context";
import { RealtimeProvider } from "./RealtimeProvider";

const TABLE = "2d0f8e4a-3c4d-4e5f-8a0b-2c3d4e5f6071";

/** Stands in for the browser's WebSocket and records what the app sends. */
class FakeSocket {
  static last: FakeSocket | null = null;
  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;

  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeSocket.last = this;
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = 3;
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

function Table() {
  return <p>{useRealtimeTable(TABLE)}</p>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeSocket.last = null;
});

describe("RealtimeProvider", () => {
  it("authenticates with a ticket, listens to the table and refetches what changed", async () => {
    vi.stubGlobal("WebSocket", Object.assign(FakeSocket, { OPEN: 1 }));
    mockApi(() => ({ ticket: "ticket-1", url: "ws://api.test/api/realtime" }));
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <RealtimeProvider>{children}</RealtimeProvider>
      </QueryClientProvider>
    );
    render(<Table />, { wrapper });

    await waitFor(() => expect(FakeSocket.last?.url).toBe("ws://api.test/api/realtime"));
    const socket = FakeSocket.last!;
    act(() => socket.open());
    expect(socket.sent).toEqual([{ type: "auth", ticket: "ticket-1" }]);

    act(() => socket.receive({ type: "ready" }));
    expect(await screen.findByText("live")).toBeInTheDocument();
    expect(socket.sent).toContainEqual({ type: "subscribe", tableId: TABLE });

    act(() => socket.receive({ type: "changed", tableId: TABLE, scope: "records" }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tableKeys.records(TABLE) });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: tableKeys.sharing(TABLE) });
  });
});
