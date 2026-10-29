import type { CellValue } from "@wisedata/shared";
import { useTranslation } from "react-i18next";

/** The text shown for a linked record: its first column, or a placeholder. */
export function useLinkedText() {
  const { t } = useTranslation("records");
  return (value: CellValue | undefined, linked: Record<string, string>): string => {
    if (typeof value !== "string") {
      return "";
    }
    const label = linked[value];
    // No label: a record of a table the user can't open (ADR-022).
    return label === undefined ? t("relation.hidden") : label || t("relation.untitled");
  };
}
