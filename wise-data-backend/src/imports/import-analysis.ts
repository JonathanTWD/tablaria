import {
  type CellValue,
  type ImportCellError,
  type ImportCheck,
  type importSchema,
  MAX_IMPORT_ERRORS,
  MAX_SELECT_CHOICES,
  type RecordColumn,
  type RecordData,
  recordDataSchema,
  SELECT_CHOICE_MAX_LENGTH,
  SELECT_COLORS,
  type SelectChoice,
} from '@wisedata/shared';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { importCellValue } from './import-value';

export type ImportRequest = z.output<typeof importSchema>;

export interface ImportAnalysis {
  check: ImportCheck;
  /** Valid rows, ready to store (defaults applied). */
  records: RecordData[];
  /** Select columns with the choices the import adds, when it adds any. */
  extendedColumns: RecordColumn[];
}

/**
 * Converts and validates every row of an import against the table's columns,
 * with the same rules as creating a record by hand. With `addMissingChoices`,
 * values no select choice matches become new choices instead of errors.
 */
export function analyzeImport(
  columns: RecordColumn[],
  request: ImportRequest,
): ImportAnalysis {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const mapped = request.columns.map((id) => (id ? byId.get(id) : null));
  const unknown = request.columns.findIndex(
    (id, index) => id !== null && !mapped[index],
  );
  if (unknown !== -1) {
    throw new UnknownImportColumnError(request.columns[unknown] ?? '');
  }

  const missingChoices = findMissingChoices(mapped, request.rows);
  const extendedColumns = request.addMissingChoices
    ? withChoices(columns, missingChoices)
    : [];
  const effective = columns.map(
    (column) => extendedColumns.find(({ id }) => id === column.id) ?? column,
  );
  const effectiveById = new Map(effective.map((column) => [column.id, column]));
  const schema = recordDataSchema(effective, { partial: false });

  const errors: ImportCellError[] = [];
  const records: RecordData[] = [];
  request.rows.forEach((cells, index) => {
    const row = index + 1;
    const data: Record<string, CellValue> = {};
    const rowErrors: ImportCellError[] = [];
    mapped.forEach((column, position) => {
      if (!column) {
        return;
      }
      const value = cells[position] ?? '';
      const cell = importCellValue(
        value,
        effectiveById.get(column.id) ?? column,
      );
      if ('error' in cell) {
        rowErrors.push({ row, columnId: column.id, value, reason: cell.error });
      } else {
        data[column.id] = cell.value;
      }
    });
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const columnId = String(issue.path[0]);
        if (!rowErrors.some((error) => error.columnId === columnId)) {
          rowErrors.push({ row, columnId, value: '', reason: 'required' });
        }
      }
    }
    if (rowErrors.length > 0 || !parsed.success) {
      errors.push(...rowErrors);
    } else {
      records.push(parsed.data);
    }
  });

  return {
    check: {
      rows: request.rows.length,
      validRows: records.length,
      errorCount: errors.length,
      errors: errors.slice(0, MAX_IMPORT_ERRORS),
      // A column holds at most MAX_SELECT_CHOICES choices: more is never needed here.
      missingChoices: [...missingChoices].map(([columnId, values]) => ({
        columnId,
        values: values.slice(0, MAX_SELECT_CHOICES),
      })),
    },
    records,
    extendedColumns: extendedColumns.filter((column) => {
      const original = byId.get(column.id);
      return (
        column.type === 'select' &&
        original?.type === 'select' &&
        column.options.choices.length > original.options.choices.length
      );
    }),
  };
}

export class UnknownImportColumnError extends Error {
  constructor(readonly columnId: string) {
    super(`Column ${columnId} is not in this table`);
  }
}

/** Distinct values (first spelling wins, ignoring case) that no choice matches. */
function findMissingChoices(
  mapped: (RecordColumn | null | undefined)[],
  rows: string[][],
): Map<string, string[]> {
  const missing = new Map<string, string[]>();
  mapped.forEach((column, position) => {
    if (column?.type !== 'select') {
      return;
    }
    const known = new Set(
      column.options.choices.map(({ label }) => label.toLocaleLowerCase()),
    );
    const values: string[] = [];
    for (const cells of rows) {
      const value = (cells[position] ?? '').trim();
      const key = value.toLocaleLowerCase();
      if (value !== '' && !known.has(key)) {
        known.add(key);
        values.push(value);
      }
    }
    if (values.length > 0) {
      missing.set(column.id, values);
    }
  });
  return missing;
}

function withChoices(
  columns: RecordColumn[],
  missing: Map<string, string[]>,
): RecordColumn[] {
  return columns.flatMap((column) => {
    const values = missing.get(column.id);
    if (column.type !== 'select' || !values) {
      return [];
    }
    // Values too long for a choice, or past the limit, stay errors.
    const room = MAX_SELECT_CHOICES - column.options.choices.length;
    const fitting = values
      .filter((label) => label.length <= SELECT_CHOICE_MAX_LENGTH)
      .slice(0, Math.max(room, 0));
    const added: SelectChoice[] = fitting.map((label, index) => ({
      id: randomUUID(),
      label,
      color:
        SELECT_COLORS[
          (column.options.choices.length + index) % SELECT_COLORS.length
        ],
    }));
    return [
      {
        ...column,
        options: { choices: [...column.options.choices, ...added] },
      },
    ];
  });
}
