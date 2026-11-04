import type { ColumnType, SelectColor } from "@tablaria/shared";
import {
  CalendarDays,
  Coins,
  Hash,
  Link2,
  ListChecks,
  Sigma,
  SquareFunction,
  TextSearch,
  ToggleLeft,
  Type,
  type LucideIcon,
} from "lucide-react";

export const COLUMN_TYPE_ICONS: Record<ColumnType, LucideIcon> = {
  text: Type,
  number: Hash,
  date: CalendarDays,
  boolean: ToggleLeft,
  select: ListChecks,
  currency: Coins,
  relation: Link2,
  lookup: TextSearch,
  rollup: Sigma,
  formula: SquareFunction,
};

/** Chip colors for select choices; every pair keeps 4.5:1 contrast in both themes. */
export const SELECT_CHIP_CLASSES: Record<SelectColor, string> = {
  gray: "bg-zinc-100 text-zinc-800 dark:bg-zinc-500/20 dark:text-zinc-200",
  red: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  green: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200",
  teal: "bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200",
  pink: "bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200",
};

export const SELECT_SWATCH_CLASSES: Record<SelectColor, string> = {
  gray: "bg-zinc-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  green: "bg-green-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};

/** Bar fills in charts, the same hues as the swatches. */
export const SELECT_FILL_CLASSES: Record<SelectColor, string> = {
  gray: "fill-zinc-500",
  red: "fill-red-500",
  orange: "fill-orange-500",
  amber: "fill-amber-500",
  green: "fill-green-500",
  teal: "fill-teal-500",
  blue: "fill-blue-500",
  indigo: "fill-indigo-500",
  purple: "fill-purple-500",
  pink: "fill-pink-500",
};

/** Offered first in the currency picker; any ISO 4217 code is valid for the API. */
export const COMMON_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "MXN",
  "ARS",
  "COP",
  "CLP",
  "PEN",
  "BRL",
  "CHF",
  "CAD",
  "JPY",
] as const;
