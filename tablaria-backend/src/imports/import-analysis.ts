import {
  type CellValue,
  type ColumnDefinition,
  type ImportCellError,
  type ImportCheck,
  type importSchema,
  MAX_COLUMNS_PER_TABLE,
  MAX_IMPORT_ERRORS,
  MAX_SELECT_CHOICES,
  type RecordColumn,
  type RecordData,
  recordDataSchema,
  SELECT_CHOICE_MAX_LENGTH,
  SELECT_COLORS,
  type SelectChoice,
} from '@tablaria/shared';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { uniqueKey } from '../records/unique-values';
import { importCellValue } from './import-value';

export type ImportRequest = z.output<typeof importSchema>;

/** The table's columns once the import has run: existing ones and new ones. */
export interface ImportPlan {
  /** For each column of the file, the column it fills (null: skipped). */
  targets: (RecordColumn | null)[];
  /** Every column of the table after the import, existing first. */
  columns: RecordColumn[];
  /** Columns the import creates, with the ids they will have. */
  created: RecordColumn[];
}

export interface ImportAnalysis {
  check: ImportCheck;
  /** Valid rows that add a record, ready to store (defaults applied). */
  records: RecordData[];
  /** Valid rows that update a record: only the cells the file brings. */
  updates: { id: string; data: RecordData }[];
  /** Existing select columns with the choices the import adds. */
  extendedColumns: RecordColumn[];
  /** The new columns as they will be stored, with any choices the import adds. */
  createdColumns: RecordColumn[];
}

/** A request that can't describe an import into this table. */
export class InvalidImportError extends Error {
  constructor(
    message: string,
    readonly conflict = false,
  ) {
    super(message);
  }
}

/**
 * Resolves each column of the file to an existing column of the table or to
 * a new one. New columns get their ids here, so the check and the import
 * validate against exactly what will be stored.
 */
export function planImport(
  existing: RecordColumn[],
  targets: ImportRequest['columns'],
): ImportPlan {
  const byId = new Map(existing.map((column) => [column.id, column]));
  const names = new Set(existing.map(({ name }) => name.toLocaleLowerCase()));
  const created: RecordColumn[] = [];
  const resolved = targets.map((target): RecordColumn | null => {
    if (target === null) {
      return null;
    }
    if (typeof target === 'string') {
      const column = byId.get(target);
      if (!column) {
        throw new InvalidImportError(`Column ${target} is not in this table`);
      }
      if (column.type === 'lookup' || column.type === 'rollup') {
        throw new InvalidImportError(
          `An import cannot fill ${column.type} columns`,
        );
      }
      return column;
    }
    if (
      target.create.type === 'relation' ||
      target.create.type === 'lookup' ||
      target.create.type === 'rollup'
    ) {
      // What they link to is decided in the column settings, not in a file.
      throw new InvalidImportError(
        `An import cannot create ${target.create.type} columns`,
      );
    }
    const name = target.create.name.toLocaleLowerCase();
    if (names.has(name)) {
      throw new InvalidImportError(
        `A column named "${target.create.name}" already exists`,
        true,
      );
    }
    names.add(name);
    const column: RecordColumn = { ...target.create, id: randomUUID() };
    created.push(column);
    return column;
  });
  if (existing.length + created.length > MAX_COLUMNS_PER_TABLE) {
    throw new InvalidImportError('Column limit reached', true);
  }
  return { targets: resolved, columns: [...existing, ...created], created };
}

/** What unique columns already hold, for duplicates and updates (ADR-023). */
export interface ImportUniqueness {
  /** For each unique column of the table: each taken key and its record. */
  taken: Map<string, Map<string, string>>;
  /** Position of the file column whose value finds the record to update. */
  updateBy?: number;
}

/**
 * Converts and validates every row against the planned columns, with the same
 * rules as creating a record by hand. With `addMissingChoices`, values no
 * select choice matches become new choices instead of errors. Unique columns
 * refuse values repeated in the file or held by another record; with
 * `updateBy`, a row whose key a record holds updates that record.
 */
export function analyzeImport(
  plan: ImportPlan,
  rows: string[][],
  addMissingChoices: boolean,
  uniqueness: ImportUniqueness = { taken: new Map() },
): ImportAnalysis {
  const keyColumn =
    uniqueness.updateBy === undefined
      ? undefined
      : plan.targets[uniqueness.updateBy];
  if (uniqueness.updateBy !== undefined && !keyColumn?.unique) {
    throw new InvalidImportError(
      'Updates need a file column mapped to a unique column',
    );
  }
  const missingChoices = findMissingChoices(plan.targets, rows);
  const extended = addMissingChoices
    ? withChoices(plan.columns, missingChoices, plan.targets)
    : new Map<string, RecordColumn>();
  const columns = plan.columns.map(
    (column) => extended.get(column.id) ?? column,
  );
  const targets = plan.targets.map(
    (column) => column && (extended.get(column.id) ?? column),
  );
  const fileColumnOf = new Map(
    targets.flatMap((column, index) => (column ? [[column.id, index]] : [])),
  );
  // Required columns no column of the file fills fail every row: said once.
  const missingRequired = columns
    .filter(
      (column) =>
        column.required &&
        column.defaultValue === null &&
        !fileColumnOf.has(column.id),
    )
    .map(({ id }) => id);
  const schema = recordDataSchema(columns, { partial: false });
  const updateSchema = recordDataSchema(columns, { partial: true });
  // Keys already seen in the file, per unique column.
  const seen = new Map<string, Set<string>>();

  const errors: ImportCellError[] = [];
  const records: RecordData[] = [];
  const updates: ImportAnalysis['updates'] = [];
  // Rows that would add a record, valid or not: they need the required columns.
  let creating = 0;
  rows.forEach((cells, index) => {
    const row = index + 1;
    const data: Record<string, CellValue> = {};
    const rowErrors: ImportCellError[] = [];
    targets.forEach((column, position) => {
      if (!column) {
        return;
      }
      const value = cells[position] ?? '';
      const cell = importCellValue(value, column);
      if ('error' in cell) {
        rowErrors.push({ row, column: position, value, reason: cell.error });
      } else {
        data[column.id] = cell.value;
      }
    });
    // The record this row updates, found by the value of its key column.
    const keyOf = (column: RecordColumn) => uniqueKey(data[column.id]);
    const updateKey = keyColumn ? keyOf(keyColumn) : null;
    const updateId =
      keyColumn && updateKey !== null
        ? uniqueness.taken.get(keyColumn.id)?.get(updateKey)
        : undefined;
    targets.forEach((column, position) => {
      const key = column?.unique ? keyOf(column) : null;
      if (!column || key === null) {
        return;
      }
      const inFile = seen.get(column.id) ?? new Set<string>();
      const holder = uniqueness.taken.get(column.id)?.get(key);
      if (inFile.has(key) || (holder !== undefined && holder !== updateId)) {
        rowErrors.push({
          row,
          column: position,
          value: cells[position] ?? '',
          reason: 'duplicate',
        });
      }
      inFile.add(key);
      seen.set(column.id, inFile);
    });
    if (!updateId) {
      creating++;
    }
    const parsed = (updateId ? updateSchema : schema).safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const position = fileColumnOf.get(String(issue.path[0]));
        if (
          position !== undefined &&
          !rowErrors.some((error) => error.column === position)
        ) {
          rowErrors.push({
            row,
            column: position,
            value: '',
            reason: 'required',
          });
        }
      }
    }
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else if (parsed.success && updateId && keyColumn) {
      // The key only finds the record: its stored spelling stays.
      const changes = Object.fromEntries(
        Object.entries(parsed.data).filter(([id]) => id !== keyColumn.id),
      );
      updates.push({ id: updateId, data: changes });
    } else if (parsed.success) {
      records.push(parsed.data);
    }
  });
  // Updated rows keep their record's other cells: only new records need them.
  const blocking = creating > 0 ? missingRequired : [];

  return {
    check: {
      rows: rows.length,
      validRows: blocking.length > 0 ? 0 : records.length + updates.length,
      toUpdate: blocking.length > 0 ? 0 : updates.length,
      errorCount: errors.length,
      errors: errors.slice(0, MAX_IMPORT_ERRORS),
      // A column holds at most MAX_SELECT_CHOICES choices: more is never needed here.
      missingChoices: [...missingChoices].map(([column, values]) => ({
        column,
        values: values.slice(0, MAX_SELECT_CHOICES),
      })),
      missingRequired: blocking,
    },
    records,
    updates,
    extendedColumns: [...extended.values()].filter(
      (column) => !plan.created.some(({ id }) => id === column.id),
    ),
    createdColumns: plan.created.map(
      (column) => extended.get(column.id) ?? column,
    ),
  };
}

/** By column of the file: distinct values (first spelling wins) no choice matches. */
function findMissingChoices(
  targets: (RecordColumn | null)[],
  rows: string[][],
): Map<number, string[]> {
  const missing = new Map<number, string[]>();
  targets.forEach((column, position) => {
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
      missing.set(position, values);
    }
  });
  return missing;
}

/** The select columns with their missing values added as choices, by column id. */
function withChoices(
  columns: RecordColumn[],
  missing: Map<number, string[]>,
  targets: (RecordColumn | null)[],
): Map<string, RecordColumn> {
  const extended = new Map<string, RecordColumn>();
  for (const [position, values] of missing) {
    const column = targets[position];
    const current = column && columns.find(({ id }) => id === column.id);
    if (current?.type !== 'select') {
      continue;
    }
    // Values too long for a choice, or past the limit, stay errors.
    const room = MAX_SELECT_CHOICES - current.options.choices.length;
    const fitting = values
      .filter((label) => label.length <= SELECT_CHOICE_MAX_LENGTH)
      .slice(0, Math.max(room, 0));
    if (fitting.length === 0) {
      continue;
    }
    const added: SelectChoice[] = fitting.map((label, index) => ({
      id: randomUUID(),
      label,
      color:
        SELECT_COLORS[
          (current.options.choices.length + index) % SELECT_COLORS.length
        ],
    }));
    const definition: ColumnDefinition = {
      ...current,
      options: { choices: [...current.options.choices, ...added] },
    };
    extended.set(current.id, { ...definition, id: current.id });
  }
  return extended;
}
