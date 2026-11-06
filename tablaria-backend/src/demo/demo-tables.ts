import {
  type ActivityDetails,
  type CellValue,
  type ColumnDefinition,
  columnDefinitionSchema,
  type RecordColumn,
  type RecordData,
  recordDataSchema,
} from '@tablaria/shared';
import { STORED_ACTIONS } from '../activity/activity-log';
import { toColumnData } from '../columns/column-mapper';
import { prepareFormula } from '../formulas/formulas';
import type { Prisma } from '../generated/prisma/client';
import { withoutEmptyCells } from '../records/record-data';
import type {
  DemoColumn,
  DemoMovement,
  DemoTable,
  DemoTableKey,
} from './demo-data';

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;
const COMPUTED = new Set<string>(['lookup', 'rollup', 'formula']);
/** Links in a multiple relation cell, as the CSV export writes them. */
const LINK_SEPARATOR = ', ';

export interface DemoSpaces {
  personalId: string;
  organizationId: string;
  visitorId: string;
  /** The example organization's members, by name. */
  memberIds: ReadonlyMap<string, string>;
  now: Date;
}

/** One demo table as created: its id, its columns and its records by name. */
interface CreatedTable {
  id: string;
  columns: Map<string, RecordColumn>;
  /** Record ids by their first cell, so links can name them. */
  records: Map<string, string>;
}

/** The demo tables created so far, by key and by id. */
class DemoTables {
  private readonly byKey = new Map<DemoTableKey, CreatedTable>();

  add(key: DemoTableKey, id: string): void {
    this.byKey.set(key, { id, columns: new Map(), records: new Map() });
  }

  get(key: DemoTableKey): CreatedTable {
    const table = this.byKey.get(key);
    if (!table) {
      throw new Error(`Demo table "${key}" was not created`);
    }
    return table;
  }

  withId(id: string): CreatedTable {
    const table = [...this.byKey.values()].find((item) => item.id === id);
    if (!table) {
      throw new Error(`Demo table ${id} was not created`);
    }
    return table;
  }
}

/**
 * Creates the demo tables as a visitor would build them (ADR-037): the stored
 * columns, then the records in the order the tables come (linked tables
 * first) with their stock history and activity, then the columns computed
 * from them. Columns and records go through the same validation as the API.
 */
export async function createDemoTables(
  tx: Tx,
  tables: DemoTable[],
  displayOrder: DemoTableKey[],
  spaces: DemoSpaces,
): Promise<void> {
  const created = new DemoTables();
  // Lists show the most recently edited table first. Created in one go, the
  // tables could share a millisecond: each gets its own edit time, a second apart.
  for (const [index, key] of displayOrder.entries()) {
    const table = tables.find((item) => item.key === key);
    if (!table) {
      throw new Error(`Demo table "${key}" is not defined`);
    }
    const { id } = await tx.inventoryTable.create({
      data: {
        organizationId: table.inOrganization
          ? spaces.organizationId
          : spaces.personalId,
        createdById: spaces.visitorId,
        name: table.name,
        description: table.description,
        updatedAt: new Date(spaces.now.getTime() - index * 1000),
      },
      select: { id: true },
    });
    created.add(key, id);
  }

  for (const table of tables) {
    const target = created.get(table.key);
    for (const [position, demo] of table.columns.entries()) {
      if (!COMPUTED.has(demo.type)) {
        await addColumn(tx, target, position, storedColumn(demo, created));
      }
    }
  }
  for (const table of tables) {
    await addRecords(tx, table, created, spaces);
  }
  for (const table of tables) {
    const target = created.get(table.key);
    for (const [position, demo] of table.columns.entries()) {
      if (COMPUTED.has(demo.type)) {
        const definition = computedColumn(demo, target, created);
        // Formulas get their stored expression and result type, as in the API.
        await addColumn(
          tx,
          target,
          position,
          await prepareFormula(tx, target.id, definition),
        );
      }
    }
  }
}

async function addColumn(
  tx: Tx,
  table: CreatedTable,
  position: number,
  definition: ColumnDefinition,
): Promise<void> {
  const { id } = await tx.column.create({
    data: { ...toColumnData(definition), tableId: table.id, position },
    select: { id: true },
  });
  table.columns.set(definition.name, { ...definition, id });
}

function columnNamed(table: CreatedTable, name: string): RecordColumn {
  const found = table.columns.get(name);
  if (!found) {
    throw new Error(`Demo column "${name}" was not created`);
  }
  return found;
}

function storedColumn(demo: DemoColumn, created: DemoTables): ColumnDefinition {
  if (demo.type === 'relation' && 'table' in demo) {
    return columnDefinitionSchema.parse({
      name: demo.name,
      type: 'relation',
      options: { tableId: created.get(demo.table).id, multiple: demo.multiple },
    });
  }
  return columnDefinitionSchema.parse(demo);
}

function computedColumn(
  demo: DemoColumn,
  table: CreatedTable,
  created: DemoTables,
): ColumnDefinition {
  if (demo.type === 'lookup' && 'target' in demo && 'relation' in demo) {
    const relation = columnNamed(table, demo.relation);
    if (relation.type === 'relation') {
      const linked = created.withId(relation.options.tableId);
      return columnDefinitionSchema.parse({
        name: demo.name,
        type: 'lookup',
        options: {
          relationColumnId: relation.id,
          targetColumnId: columnNamed(linked, demo.target).id,
        },
      });
    }
  }
  if (demo.type === 'rollup' && 'function' in demo) {
    const linking = created.get(demo.table);
    return columnDefinitionSchema.parse({
      name: demo.name,
      type: 'rollup',
      options: {
        relationColumnId: columnNamed(linking, demo.relation).id,
        function: demo.function,
        targetColumnId: demo.target
          ? columnNamed(linking, demo.target).id
          : null,
      },
    });
  }
  if (demo.type === 'formula' && 'expression' in demo) {
    return columnDefinitionSchema.parse({
      name: demo.name,
      type: 'formula',
      options: { expression: demo.expression, currency: demo.currency },
    });
  }
  throw new Error(`Demo column "${demo.name}" is not well defined`);
}

/**
 * The table's records, added one by one over `spreadDays` up to today, with
 * their links resolved by name, the stock history behind each stock cell and
 * an activity event for each addition and movement.
 */
async function addRecords(
  tx: Tx,
  table: DemoTable,
  created: DemoTables,
  spaces: DemoSpaces,
): Promise<void> {
  const target = created.get(table.key);
  const columns = [...target.columns.values()];
  const [first] = columns;
  // The same validation as the API, so the demo data can never drift from the rules.
  const schema = recordDataSchema(columns, { partial: false });
  const authorOf = (name?: string) =>
    (name && spaces.memberIds.get(name)) ?? spaces.visitorId;
  const author = authorOf(table.addedBy);
  const last = Math.max(table.rows.length - 1, 1);

  for (const [index, row] of table.rows.entries()) {
    const createdAt = new Date(
      spaces.now.getTime() -
        ((table.spreadDays * (last - index)) / last) * DAY_MS,
    );
    const data = schema.parse(
      Object.fromEntries(
        columns.map((column) => [
          column.id,
          cellValue(column, row[column.name] ?? null, created),
        ]),
      ),
    );
    const record = await tx.record.create({
      data: {
        tableId: target.id,
        data: withoutEmptyCells(data),
        createdAt,
        updatedAt: createdAt,
      },
      select: { id: true },
    });
    const name = String(row[first.name]);
    target.records.set(name, record.id);
    await event(tx, target.id, author, 'record.created', createdAt, {
      recordId: record.id,
      label: name,
    });
    await addStockHistory(tx, table, target, columns, record.id, name, data, {
      createdAt,
      author,
      authorOf,
      now: spaces.now,
    });
  }
}

/** A row's cell as stored: a relation names its records, which are found by name. */
function cellValue(
  column: RecordColumn,
  value: CellValue,
  created: DemoTables,
): CellValue {
  if (column.type !== 'relation' || typeof value !== 'string') {
    return value;
  }
  const linked = created.withId(column.options.tableId);
  const ids = value.split(LINK_SEPARATOR).map((name) => {
    const id = linked.records.get(name);
    if (!id) {
      throw new Error(`Demo record "${name}" does not exist yet`);
    }
    return id;
  });
  return column.options.multiple ? ids : ids[0];
}

/**
 * The movements that lead to each stock cell: a first count when the record
 * was added, then the table's movements of that record, each on its day.
 */
async function addStockHistory(
  tx: Tx,
  table: DemoTable,
  target: CreatedTable,
  columns: RecordColumn[],
  recordId: string,
  name: string,
  data: RecordData,
  when: {
    createdAt: Date;
    author: string;
    authorOf: (name?: string) => string;
    now: Date;
  },
): Promise<void> {
  const movements: DemoMovement[] = (table.movements ?? [])
    .filter(({ record }) => record === name)
    .sort((a, b) => b.daysAgo - a.daysAgo);
  for (const column of columns.filter(({ stock }) => stock)) {
    const final = Number(data[column.id] ?? 0);
    let balance = movements.reduce((rest, { delta }) => rest - delta, final);
    const history = [
      {
        kind: 'COUNT' as const,
        delta: balance,
        balance,
        note: 'Inventario inicial',
        createdAt: when.createdAt,
        userId: when.author,
      },
      ...movements.map((movement) => {
        balance += movement.delta;
        return {
          kind: movement.kind,
          delta: movement.delta,
          balance,
          note: movement.note,
          createdAt: new Date(when.now.getTime() - movement.daysAgo * DAY_MS),
          userId: when.authorOf(movement.by),
        };
      }),
    ].filter(({ delta }) => delta !== 0);
    await tx.stockMovement.createMany({
      data: history.map((movement) => ({
        ...movement,
        tableId: target.id,
        recordId,
        columnId: column.id,
      })),
    });
    for (const movement of history.slice(1)) {
      await event(
        tx,
        target.id,
        movement.userId,
        'stock.moved',
        movement.createdAt,
        {
          recordId,
          label: name,
          details: {
            kind:
              movement.kind === 'IN'
                ? 'in'
                : movement.kind === 'OUT'
                  ? 'out'
                  : 'count',
            delta: movement.delta,
            column: column.name,
          },
        },
      );
    }
  }
}

async function event(
  tx: Tx,
  tableId: string,
  userId: string,
  action: 'record.created' | 'stock.moved',
  createdAt: Date,
  {
    recordId,
    label,
    details = {},
  }: { recordId: string; label: string; details?: ActivityDetails },
): Promise<void> {
  await tx.activityEvent.create({
    data: {
      tableId,
      userId,
      action: STORED_ACTIONS[action],
      recordId,
      label,
      details: details as Prisma.InputJsonValue,
      createdAt,
    },
  });
}
