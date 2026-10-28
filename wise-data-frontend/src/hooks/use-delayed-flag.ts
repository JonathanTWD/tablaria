import { useEffect, useState } from "react";

/**
 * True once `active` has stayed true for `delayMs`, e.g. to explain a slow
 * request (the free host wakes the API up on the first visit) without
 * flashing a message on fast ones.
 */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setTimeout(() => setElapsed(true), delayMs);
    return () => {
      window.clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, delayMs]);

  return active && elapsed;
}
