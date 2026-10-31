import { type CellValue, linkedRecordIds } from "@tablaria/shared";
import { useTranslation } from "react-i18next";

/**
 * The text shown for the linked records: their first column, or a
 * placeholder, comma-separated when there are several (ADR-032).
 */
export function useLinkedText() {
  const { t } = useTranslation("records");
  return (value: CellValue | undefined, linked: Record<string, string>): string =>
    linkedRecordIds(value)
      .map((id) => {
        const label = linked[id];
        // No label: a record of a table the user can't open (ADR-022).
        return label === undefined ? t("relation.hidden") : label || t("relation.untitled");
      })
      .join(", ");
}
