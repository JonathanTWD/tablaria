import { useSyncExternalStore } from "react";

/** Chrome's install event; not in TypeScript's DOM library. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

// Chrome and Edge offer the app once the manifest qualifies (ADR-051). The event
// fires early, so this module is imported by main.tsx before anything renders.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Kept for the "Instalar la app" menu item instead of Chrome's own banner.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens the browser's install dialog, or null where it can't (Safari, Firefox, already installed). */
export function useInstallApp(): (() => Promise<void>) | null {
  const event = useSyncExternalStore(
    subscribe,
    () => deferred,
    () => null,
  );
  if (!event) {
    return null;
  }
  return async () => {
    await event.prompt();
    await event.userChoice;
    // A prompt can be shown once; Chrome fires a new event if it can offer it again.
    deferred = null;
    notify();
  };
}
