import type { CellValue, ColumnDefinition } from "@tablaria/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export type CellFormatter = (column: ColumnDefinition, value: CellValue | undefined) => string;

const currencyFormats = new Map<string, Intl.NumberFormat>();

/** Shared across renders and tables: one formatter per locale and currency. */
function currencyFormat(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}|${currency}`;
  let format = currencyFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, { style: "currency", currency });
    currencyFormats.set(key, format);
  }
  return format;
}

/**
 * Formats cell values as the user reads them ("" for empty cells). The Intl
 * formatters are built once per language, not once per cell.
 */
export function useCellFormatter(): CellFormatter {
  const { t, i18n } = useTranslation("tables");
  const locale = i18n.language;

  return useMemo(() => {
    const number = new Intl.NumberFormat(locale);
    // Dates have no time zone; formatting them as UTC keeps the same day everywhere.
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });

    return (column, value) => {
      if (value === null || value === undefined) {
        return "";
      }
      switch (column.type) {
        case "boolean":
          return value ? t("columns.yes") : t("columns.no");
        case "currency":
          return currencyFormat(locale, column.options.currency).format(Number(value));
        case "number":
          return number.format(Number(value));
        case "date":
          return date.format(new Date(`${String(value)}T00:00:00Z`));
        default:
          return String(value);
      }
    };
  }, [locale, t]);
}
