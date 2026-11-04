import { UnprocessableEntityException } from '@nestjs/common';
import {
  checkFormula,
  type ColumnDefinition,
  evaluateFormula,
  findFormulaColumn,
  FormulaError,
  type FormulaOptions,
  type FormulaType,
  formulaTypeOfColumn,
  formulaTypeOfRollup,
  type FormulaValue,
  parseFormula,
  type RecordColumn,
  type RecordData,
  renameFormulaColumns,
} from '@tablaria/shared';
import { toTableColumn } from '../columns/column-mapper';
import type { Prisma } from '../generated/prisma/client';

/** Formula columns compute a value from the record's cells, never stored (ADR-033). */

type Db = Prisma.TransactionClient;

type FormulaColumn = Extract<RecordColumn, { type: 'formula' }>;

function isFormula(column: RecordColumn): column is FormulaColumn {
  return column.type === 'formula';
}

/** The day HOY() gives: Tablaria's users are in Spain, not in UTC (ADR-033). */
const TODAY_TIME_ZONE = 'Europe/Madrid';

function todayIn(timeZone: string, now = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/**
 * The type each column of a table has inside a formula, or null when it
 * can't be cited: lookups by the column they show and rollups by what they
 * add up. Read regardless of who asks, since it defines the column.
 */
async function citableTypes(
  db: Db,
  columns: RecordColumn[],
): Promise<Map<string, FormulaType | null>> {
  const targetIds = columns.flatMap((column) =>
    (column.type === 'lookup' || column.type === 'rollup') &&
    column.options.targetColumnId !== null
      ? [column.options.targetColumnId]
      : [],
  );
  const targets =
    targetIds.length === 0
      ? []
      : await db.column.findMany({
          where: { id: { in: targetIds } },
          select: { id: true, type: true },
        });
  const targetType = new Map(targets.map(({ id, type }) => [id, type]));

  return new Map(
    columns.map((column) => {
      switch (column.type) {
        case 'lookup': {
          const type = targetType.get(column.options.targetColumnId);
          return [column.id, type ? formulaTypeOfColumn(type) : null];
        }
        case 'rollup': {
          const { targetColumnId } = column.options;
          if (targetColumnId !== null && !targetType.has(targetColumnId)) {
            return [column.id, null];
          }
          return [
            column.id,
            formulaTypeOfRollup(
              targetColumnId === null
                ? undefined
                : targetType.get(targetColumnId),
            ),
          ];
        }
        default:
          return [column.id, formulaTypeOfColumn(column.type)];
      }
    }),
  );
}

/**
 * Checks a formula against the other columns of its table, citing them by id
 * or by name, and returns its options with ids and the type of its result.
 * Throws FormulaError when it doesn't fit.
 */
function resolveFormula(
  options: FormulaOptions,
  columns: RecordColumn[],
  types: ReadonlyMap<string, FormulaType | null>,
): FormulaOptions {
  const expression = renameFormulaColumns(
    options.expression,
    (ref) => findFormulaColumn(columns, ref)?.id,
  );
  const resultType = checkFormula(parseFormula(expression), (ref) =>
    types.get(ref),
  );
  if (resultType === 'unknown') {
    // Every column type is known on the server.
    throw new FormulaError('types');
  }
  if (options.currency !== null && resultType !== 'number') {
    throw new FormulaError('types', 'currency');
  }
  return { ...options, expression, resultType };
}

/**
 * A formula must cite existing, citable columns of its own table and fit
 * their types (422 otherwise). Returns the definition as stored.
 */
export async function prepareFormula(
  db: Db,
  tableId: string,
  definition: ColumnDefinition,
  columnId?: string,
): Promise<ColumnDefinition> {
  if (definition.type !== 'formula') {
    return definition;
  }
  const others: RecordColumn[] = (
    await db.column.findMany({ where: { tableId, id: { not: columnId } } })
  ).map(toTableColumn);
  try {
    return {
      ...definition,
      options: resolveFormula(
        definition.options,
        others,
        await citableTypes(db, others),
      ),
    };
  } catch (error) {
    if (error instanceof FormulaError) {
      throw new UnprocessableEntityException({
        message: 'Invalid formula',
        details: [{ path: 'options.expression', message: error.message }],
      });
    }
    throw error;
  }
}

/**
 * The formula as it fits now, or null when it no longer does. A currency
 * only fits a number, so a formula that stops giving one keeps working
 * without it.
 */
function refitFormula(
  formula: FormulaColumn,
  columns: RecordColumn[],
  types: ReadonlyMap<string, FormulaType | null>,
): FormulaOptions | null {
  const others = columns.filter(({ id }) => id !== formula.id);
  for (const options of [
    formula.options,
    { ...formula.options, currency: null },
  ]) {
    try {
      return resolveFormula(options, others, types);
    } catch (error) {
      if (!(error instanceof FormulaError)) {
        throw error;
      }
    }
  }
  return null;
}

/**
 * Checks again the formulas of these tables after their columns changed:
 * those that no longer fit are deleted, as lookups are, and the others
 * follow their new result type. Returns the tables that changed.
 */
export async function syncFormulas(
  tx: Db,
  tableIds: string[],
): Promise<string[]> {
  const withFormulas = await tx.column.findMany({
    where: { tableId: { in: [...new Set(tableIds)] }, type: 'formula' },
    distinct: ['tableId'],
    select: { tableId: true },
  });
  const changed: string[] = [];
  for (const { tableId } of withFormulas) {
    const columns: RecordColumn[] = (
      await tx.column.findMany({ where: { tableId } })
    ).map(toTableColumn);
    const types = await citableTypes(tx, columns);
    let tableChanged = false;
    for (const formula of columns.filter(isFormula)) {
      const options = refitFormula(formula, columns, types);
      if (options === null) {
        await tx.column.delete({ where: { id: formula.id } });
        tableChanged = true;
      } else if (
        options.resultType !== formula.options.resultType ||
        options.currency !== formula.options.currency
      ) {
        await tx.column.update({
          where: { id: formula.id },
          data: { options },
        });
        tableChanged = true;
      }
    }
    if (tableChanged) {
      changed.push(tableId);
    }
  }
  return changed;
}

/**
 * The tables whose lookups or rollups read this column: their type inside a
 * formula follows its type.
 */
export async function tablesReading(
  tx: Db,
  columnId: string,
): Promise<string[]> {
  const columns = await tx.column.findMany({
    where: {
      type: { in: ['lookup', 'rollup'] },
      options: { path: ['targetColumnId'], equals: columnId },
    },
    select: { tableId: true },
  });
  return columns.map(({ tableId }) => tableId);
}

function formulaInput(value: unknown): FormulaValue {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? value
    : null;
}

/**
 * Writes each formula's value into the records' data, as if it were stored.
 * Runs after lookups and rollups are filled, so formulas can cite them.
 */
export function fillFormulas(
  columns: RecordColumn[],
  records: { data: RecordData }[],
  today = todayIn(TODAY_TIME_ZONE),
): void {
  const formulas = columns.filter(isFormula).flatMap((column) => {
    try {
      return [{ id: column.id, node: parseFormula(column.options.expression) }];
    } catch {
      // Checked when saved; a formula that no longer parses shows nothing.
      return [];
    }
  });
  for (const record of records) {
    for (const { id, node } of formulas) {
      const value = evaluateFormula(
        node,
        (ref) => formulaInput(record.data[ref]),
        today,
      );
      if (value !== null) {
        record.data[id] = value;
      }
    }
  }
}
