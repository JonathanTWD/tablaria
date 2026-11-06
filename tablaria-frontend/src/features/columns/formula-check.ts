import {
  checkFormula,
  findFormulaColumn,
  FormulaError,
  type FormulaColumnType,
  type FormulaErrorCode,
  formulaTypeOfColumn,
  formulaTypeOfRollup,
  parseFormula,
  type TableColumn,
  type TableDetail,
} from "@tablaria/shared";

export type FormulaCheck =
  | { ok: true; resultType: ReturnType<typeof checkFormula> }
  | { ok: false; code: FormulaErrorCode | "unexpectedEnd" | "currency"; detail: string };

/**
 * The type a column has inside a formula, as far as this user can tell: a
 * lookup or rollup of a table they can't open is "unknown", and the API
 * checks it on save.
 */
function citableType(table: TableDetail, column: TableColumn): FormulaColumnType {
  switch (column.type) {
    case "lookup": {
      const target = table.lookupTargets[column.id];
      return target ? formulaTypeOfColumn(target.type) : "unknown";
    }
    case "rollup":
      if (column.options.function === "count") {
        return "number";
      }
      if (!(column.id in table.rollupTargets)) {
        return "unknown";
      }
      return formulaTypeOfRollup(table.rollupTargets[column.id]?.type);
    default:
      return formulaTypeOfColumn(column.type);
  }
}

/** Checks a formula as the API will, against the other columns of the table. */
export function checkFormulaIn(
  table: TableDetail,
  expression: string,
  currency: string,
  columnId?: string,
): FormulaCheck {
  const others = table.columns.filter(({ id }) => id !== columnId);
  try {
    const resultType = checkFormula(parseFormula(expression), (ref) => {
      const column = findFormulaColumn(others, ref);
      return column && citableType(table, column);
    });
    if (currency && resultType !== "number" && resultType !== "unknown") {
      return { ok: false, code: "currency", detail: "" };
    }
    return { ok: true, resultType };
  } catch (error) {
    if (!(error instanceof FormulaError)) {
      throw error;
    }
    return {
      ok: false,
      code: error.code === "unexpected" && error.detail === "" ? "unexpectedEnd" : error.code,
      detail: error.detail,
    };
  }
}
