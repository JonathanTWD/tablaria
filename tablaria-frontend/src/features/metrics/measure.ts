import { METRIC_FUNCTIONS, type TableColumn } from "@tablaria/shared";
import { useTranslation } from "react-i18next";
import { useCellFormatter } from "@/features/columns/format-value";
import { measurableColumns, parseMeasure, type MeasureKey } from "./metric-columns";

export const COUNT: MeasureKey = "count";

/**
 * What a chart can measure, for its picker ("Número de registros", "Suma de
 * Salario"…), and how to read the value of the one chosen.
 */
export function useMeasure(columns: TableColumn[], key: string) {
  const { t, i18n } = useTranslation("records");
  const format = useCellFormatter();
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 });

  const items: Record<string, string> = {
    [COUNT]: t("metrics.count"),
    ...Object.fromEntries(
      measurableColumns(columns).flatMap((column) =>
        METRIC_FUNCTIONS.map((fn) => [
          `${fn}:${column.id}`,
          t(`metrics.functions.${fn}`, { name: column.name }),
        ]),
      ),
    ),
  };
  const measure = parseMeasure(key, columns);
  return {
    items,
    /** The chosen measure; counting when it no longer exists. */
    key: measure ? key : COUNT,
    measure,
    label: items[measure ? key : COUNT],
    display: (value: number) =>
      measure ? format(measure.column, value) : number.format(value),
  };
}
