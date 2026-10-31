import {
  BadRequestException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  canBeLookedUp,
  type CellValue,
  type ColumnDefinition,
  type ColumnType,
  type RecordColumn,
  type RecordData,
  type RelationOptions,
  type TableColumn,
} from '@tablaria/shared';
import { toTableColumn } from '../columns/column-mapper';
import type { Prisma } from '../generated/prisma/client';
import type { LabelSource } from '../relations/relations';
import { tableRole } from '../tables/table-access';

/** Lookup columns show a column of the linked record, never stored (ADR-030). */

type Db = Prisma.TransactionClient;

type LookupColumn = RecordColumn & {
  type: 'lookup';
  options: { relationColumnId: string; targetColumnId: string };
};

export function isLookup(column: RecordColumn): column is LookupColumn {
  return column.type === 'lookup';
}

/** Where a lookup's values come from, for a user who can open that table. */
export interface LookupSource {
  /** The relation of this table that links each record. */
  relationColumnId: string;
  /** The linked table. */
  tableId: string;
  /** The column of the linked table it shows. */
  target: TableColumn;
}

/**
 * A lookup must read through a single relation column of its own table
 * (ADR-032), from a plain column of the table that relation links to, and
 * whoever defines it must be able to open that table.
 */
export async function requireLookupSource(
  db: Db,
  userId: string,
  tableId: string,
  definition: ColumnDefinition,
): Promise<void> {
  if (definition.type !== 'lookup') {
    return;
  }
  const relation = await db.column.findFirst({
    where: { id: definition.options.relationColumnId, tableId },
  });
  if (relation?.type !== 'relation') {
    throw new UnprocessableEntityException(
      'A lookup reads through a relation column of the same table',
    );
  }
  const { tableId: linkedTableId, multiple } =
    relation.options as RelationOptions;
  if (multiple) {
    throw new UnprocessableEntityException(
      "A lookup can't read through a multiple relation",
    );
  }
  if (!(await tableRole(db, userId, linkedTableId))) {
    throw new ForbiddenException('No access to the linked table');
  }
  const target = await db.column.findFirst({
    where: { id: definition.options.targetColumnId, tableId: linkedTableId },
  });
  if (!target || !canBeLookedUp(target.type)) {
    throw new UnprocessableEntityException(
      'A lookup shows a plain column of the linked table',
    );
  }
}

const COMPUTED_TYPES: ColumnType[] = ['lookup', 'rollup'];

/**
 * Lookups and rollups keep their type: they are created as such and stay so,
 * and no column becomes one.
 */
export function requireSameLookupType(
  current: ColumnType,
  next: ColumnType,
): void {
  if (
    current !== next &&
    (COMPUTED_TYPES.includes(current) || COMPUTED_TYPES.includes(next))
  ) {
    throw new BadRequestException("A computed column can't change type");
  }
}

/**
 * For each lookup whose linked table the user can open, where its values
 * come from. Lookups of other tables are left out: they show nothing.
 */
export async function lookupSources(
  db: Db,
  userId: string,
  columns: RecordColumn[],
): Promise<Map<string, LookupSource>> {
  const sources = new Map<string, LookupSource>();
  const access = new Map<string, boolean>();
  for (const lookup of columns.filter(isLookup)) {
    const relation = columns.find(
      ({ id }) => id === lookup.options.relationColumnId,
    );
    if (relation?.type !== 'relation' || relation.options.multiple) {
      continue;
    }
    const tableId = relation.options.tableId;
    if (!access.has(tableId)) {
      access.set(tableId, (await tableRole(db, userId, tableId)) !== null);
    }
    const target = access.get(tableId)
      ? await db.column.findFirst({
          where: { id: lookup.options.targetColumnId, tableId },
        })
      : null;
    if (target && canBeLookedUp(target.type)) {
      sources.set(lookup.id, {
        relationColumnId: relation.id,
        tableId,
        target: toTableColumn(target),
      });
    }
  }
  return sources;
}

/** The lookups as sources for searching, filtering and sorting. */
export function lookupLabelSources(
  sources: ReadonlyMap<string, LookupSource>,
): Map<string, LabelSource> {
  return new Map(
    [...sources].map(([id, source]) => [
      id,
      {
        tableId: source.tableId,
        columnId: source.target.id,
        viaColumnId: source.relationColumnId,
        type: source.target.type,
        multiple: false,
      },
    ]),
  );
}

/**
 * Writes each lookup's value into the records' data, as if it were stored,
 * reading every linked record once.
 */
export async function fillLookups(
  db: Db,
  sources: ReadonlyMap<string, LookupSource>,
  records: { data: RecordData }[],
): Promise<void> {
  const byRelation = new Map<string, [string, LookupSource][]>();
  for (const entry of sources) {
    const list = byRelation.get(entry[1].relationColumnId) ?? [];
    list.push(entry);
    byRelation.set(entry[1].relationColumnId, list);
  }
  for (const [relationColumnId, lookups] of byRelation) {
    const ids = [
      ...new Set(
        records
          .map(({ data }) => data[relationColumnId])
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
    if (ids.length === 0) {
      continue;
    }
    const linked = await db.record.findMany({
      where: { tableId: lookups[0][1].tableId, id: { in: ids } },
      select: { id: true, data: true },
    });
    const dataById = new Map(
      linked.map(({ id, data }) => [id, data as Record<string, CellValue>]),
    );
    for (const record of records) {
      const linkedData = dataById.get(String(record.data[relationColumnId]));
      for (const [lookupId, source] of lookups) {
        const value = linkedData?.[source.target.id];
        if (value !== undefined && value !== null) {
          record.data[lookupId] = value;
        }
      }
    }
  }
}

/**
 * Deletes the lookups and rollups (ADR-031) that read through these relation
 * columns or show these columns; returns the tables they were in, so open
 * pages refresh. Both keep `relationColumnId` and `targetColumnId` in their
 * options. `types` narrows it to one of them.
 */
export async function dropComputedColumns(
  tx: Db,
  {
    relationColumnIds = [],
    targetColumnIds = [],
    types = COMPUTED_TYPES,
  }: {
    relationColumnIds?: string[];
    targetColumnIds?: string[];
    types?: ColumnType[];
  },
): Promise<string[]> {
  if (relationColumnIds.length === 0 && targetColumnIds.length === 0) {
    return [];
  }
  const lookups = await tx.column.findMany({
    where: {
      type: { in: types },
      OR: [
        ...relationColumnIds.map((id) => ({
          options: { path: ['relationColumnId'], equals: id },
        })),
        ...targetColumnIds.map((id) => ({
          options: { path: ['targetColumnId'], equals: id },
        })),
      ],
    },
    select: { id: true, tableId: true },
  });
  await tx.column.deleteMany({
    where: { id: { in: lookups.map(({ id }) => id) } },
  });
  return [...new Set(lookups.map(({ tableId }) => tableId))];
}
