import { createContext, useContext } from "react";

export interface AssistantControls {
  /** False when the API has no model configured: nothing offers the assistant. */
  enabled: boolean;
  open: () => void;
}

export const AssistantContext = createContext<AssistantControls>({
  enabled: false,
  open: () => undefined,
});

/** Opens the assistant from anywhere in the app: header, menus, shortcuts. */
export function useAssistant(): AssistantControls {
  return useContext(AssistantContext);
}

/** Ctrl+K, or ⌘+K on a Mac. */
export function isAssistantShortcut(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "k"
  );
}

export function shortcutLabel(): string {
  return /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘ K" : "Ctrl K";
}
