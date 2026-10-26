import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import type { Theme } from "./theme-context";

export const THEME_OPTIONS: { value: Theme; icon: LucideIcon }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

export function isTheme(value: unknown): value is Theme {
  return THEME_OPTIONS.some((option) => option.value === value);
}
