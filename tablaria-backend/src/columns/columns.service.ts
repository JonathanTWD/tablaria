import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type CellValue,
  type ColumnDefinition,
  canBeLookedUp,
  canBeUnique,
  columnDefinitionSchema,
  MAX_COLUMNS_PER_TABLE,
  selectOptionsSchema,
  type TableColumn,
  type UpdateColumnInput,
  type UpdateColumnResponse,
} from '@tablaria/shared';
import { parseOrThrow } from '../common/pipes/zod-validation.pipe';
import { PrismaService } from '../database/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { Prisma } from '../generated/prisma/client';
import { requireNoRepeatedValues } from '../records/unique-values';
import {
  dropComputedColumns,
  requireLookupSource,
  requireSameComputedType,
} from '../lookups/lookups';
import {
  prepareFormula,
  syncFormulas,
  tablesReading,
} from '../formulas/formulas';
import { requireLinkableTable } from '../relations/relations';
import { dropRollupsNotFitting, requireRollupSource } from '../rollups/rollups';
import { accessibleTables, touchTable } from '../tables/table-access';
import { toColumnData, toTableColumn } from './column-mapper';
import { logActivity } from '../activity/activity-log';
import { convertCellValue } from './convert-value';

@Injectable()
export class ColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(userId: string, tableId: string): Promise<TableColumn[]> {
    const table = await this.prisma.inventoryTable.findFirst({
      where: { id: tableId, ...accessibleTables(userId) },
      select: { columns: { orderBy: { position: 'asc' } } },
    });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    return table.columns.map(toTableColumn);
  }

  async create(
    userId: string,
    tableId: string,
    input: ColumnDefinition,
  ): Promise<TableColumn> {
    const result = await withUniqueColumnName(() =>
      this.prisma.$transaction(async (tx) => {
        await touchTable(tx, userId, tableId, 'ADMIN');

        const { _count, _max } = await tx.column.aggregate({
          where: { tableId },
          _count: true,
          _max: { position: true },
        });
        if (_count >= MAX_COLUMNS_PER_TABLE) {
          throw new UnprocessableEntityException('Column limit reached');
        }
        await requireLinkableTable(tx, tableId, input);
        await requireLookupSource(tx, userId, tableId, input);
        await requireRollupSource(tx, userId, tableId, input);
        const definition = await prepareFormula(tx, tableId, input);

        const column = await tx.column.create({
          data: {
            ...toColumnData(definition),
            tableId,
            position: (_max.position ?? -1) + 1,
          },
        });

        if (definition.defaultValue !== null) {
          // Existing records get the default, as if they had been created after the column.
          await tx.$executeRaw`
            UPDATE records
            SET data = jsonb_set(data, ARRAY[${column.id}::text], ${JSON.stringify(definition.defaultValue)}::jsonb)
            WHERE "tableId" = ${tableId}::uuid`;
        }
        await logActivity(tx, {
          tableId,
          userId,
          action: 'column.created',
          label: column.name,
        });
        return toTableColumn(column);
      }),
    );
    this.realtime.publish(tableId, 'columns');
    return result;
  }

  async update(
    userId: string,
    tableId: string,
    columnId: string,
    patch: UpdateColumnInput,
  ): Promise<UpdateColumnResponse> {
    // Other tables whose computed columns this change removes or retypes, to refresh them too.
    let droppedIn: string[] = [];
    const result = await withUniqueColumnName(() =>
      this.prisma.$transaction(async (tx) => {
        await touchTable(tx, userId, tableId, 'ADMIN');

        const stored = await tx.column.findFirst({
          where: { id: columnId, tableId },
        });
        if (!stored) {
          throw new NotFoundException('Column not found');
        }

        const current = toTableColumn(stored);
        requireSameComputedType(current.type, patch.type ?? current.type);
        const next = await prepareFormula(
          tx,
          tableId,
          parseOrThrow(
            columnDefinitionSchema,
            mergeColumnPatch(current, patch),
          ),
          columnId,
        );
        await requireLinkableTable(tx, tableId, next);
        await requireLookupSource(tx, userId, tableId, next);
        await requireRollupSource(tx, userId, tableId, next);
        droppedIn = await dropComputedColumns(tx, {
          // A relation that links elsewhere, or no longer links.
          relationColumnIds:
            current.type === 'relation' &&
            (next.type !== 'relation' ||
              next.options.tableId !== current.options.tableId)
              ? [columnId]
              : [],
          // A column that stops being something a lookup can show.
          targetColumnIds:
            canBeLookedUp(current.type) && !canBeLookedUp(next.type)
              ? [columnId]
              : [],
        });
        if (next.type !== current.type) {
          droppedIn = [
            ...droppedIn,
            ...(await dropRollupsNotFitting(tx, columnId, next.type)),
          ];
        }
        // Lookups read through single relations only (ADR-032).
        if (
          current.type === 'relation' &&
          next.type === 'relation' &&
          next.options.multiple &&
          !current.options.multiple
        ) {
          droppedIn = [
            ...droppedIn,
            ...(await dropComputedColumns(tx, {
              relationColumnIds: [columnId],
              types: ['lookup'],
            })),
          ];
        }
        const clearedValues = await convertStoredValues(
          tx,
          tableId,
          current,
          next,
        );
        if (next.unique) {
          await requireNoRepeatedValues(tx, tableId, { ...next, id: columnId });
        }
        const column = await tx.column.update({
          where: { id: columnId },
          data: toColumnData(next),
        });
        // Formulas citing this column, or a lookup or rollup that reads it (ADR-033).
        droppedIn = [
          ...droppedIn,
          ...(await syncFormulas(tx, [
            tableId,
            ...(next.type === current.type
              ? []
              : await tablesReading(tx, columnId)),
          ])),
        ];
        await logActivity(tx, {
          tableId,
          userId,
          action: 'column.updated',
          label: next.name,
          details:
            next.name === current.name ? {} : { renamedFrom: current.name },
        });
        return { column: toTableColumn(column), clearedValues };
      }),
    );
    for (const changed of new Set([tableId, ...droppedIn])) {
      this.realtime.publish(changed, 'columns');
    }
    return result;
  }

  async reorder(
    userId: string,
    tableId: string,
    columnIds: string[],
  ): Promise<TableColumn[]> {
    const result = await this.prisma.$transaction(async (tx) => {
      await touchTable(tx, userId, tableId, 'ADMIN');

      const existing = await tx.column.findMany({
        where: { tableId },
        select: { id: true },
      });
      const isPermutation =
        existing.length === columnIds.length &&
        existing.every(({ id }) => columnIds.includes(id));
      if (!isPermutation) {
        throw new BadRequestException(
          'columnIds must list every column of the table exactly once',
        );
      }

      for (const [position, id] of columnIds.entries()) {
        await tx.column.update({ where: { id }, data: { position } });
      }
      const columns = await tx.column.findMany({
        where: { tableId },
        orderBy: { position: 'asc' },
      });
      return columns.map(toTableColumn);
    });
    this.realtime.publish(tableId, 'columns');
    return result;
  }

  async remove(
    userId: string,
    tableId: string,
    columnId: string,
  ): Promise<void> {
    const droppedIn = await this.prisma.$transaction(async (tx) => {
      await touchTable(tx, userId, tableId, 'ADMIN');

      const stored = await tx.column.findFirst({
        where: { id: columnId, tableId },
      });
      if (!stored) {
        throw new NotFoundException('Column not found');
      }
      await tx.column.delete({ where: { id: columnId } });
      await logActivity(tx, {
        tableId,
        userId,
        action: 'column.deleted',
        label: stored.name,
      });
      await tx.$executeRaw`
        UPDATE records
        SET data = data - ${columnId}::text
        WHERE "tableId" = ${tableId}::uuid AND data ? ${columnId}::text`;
      // Lookups reading through this relation, or showing this column (ADR-030).
      const dropped = await dropComputedColumns(tx, {
        relationColumnIds: [columnId],
        targetColumnIds: [columnId],
      });
      // Formulas citing it (ADR-033).
      return [...dropped, ...(await syncFormulas(tx, [tableId]))];
    });
    for (const changed of new Set([tableId, ...droppedIn])) {
      this.realtime.publish(changed, 'columns');
    }
  }
}

function mergeColumnPatch(
  current: ColumnDefinition,
  patch: UpdateColumnInput,
): unknown {
  const typeChanged = patch.type !== undefined && patch.type !== current.type;
  // Settings of the old type rarely fit the new one, so they start over unless sent.
  const keep = <T>(key: 'options' | 'defaultValue', value: T) =>
    key in patch ? patch[key] : typeChanged ? undefined : value;

  return {
    name: patch.name ?? current.name,
    required: patch.required ?? current.required,
    // A type that can't be unique drops the flag instead of failing.
    unique:
      patch.unique ??
      (typeChanged && !canBeUnique(patch.type ?? current.type)
        ? false
        : current.unique),
    stock:
      patch.stock ??
      (typeChanged && (patch.type ?? current.type) !== 'number'
        ? false
        : current.stock),
    type: patch.type ?? current.type,
    options: keep('options', current.options),
    defaultValue: keep('defaultValue', followDefaultChoice(current, patch)),
  };
}

/**
 * A select default follows its choice when new choices are sent without a
 * default: renamed with it, or cleared if the choice was removed.
 */
function followDefaultChoice(
  current: ColumnDefinition,
  patch: UpdateColumnInput,
): CellValue {
  if (current.type !== 'select' || current.defaultValue === null) {
    return current.defaultValue;
  }
  const options = selectOptionsSchema.safeParse(patch.options);
  if (!options.success) {
    // Missing options keep the current ones; invalid ones fail validation anyway.
    return current.defaultValue;
  }
  const choice = current.options.choices.find(
    ({ label }) => label === current.defaultValue,
  );
  return (
    options.data.choices.find(({ id }) => id === choice?.id)?.label ?? null
  );
}

/** Old label → new label for select choices renamed in this change. */
function choiceRenames(
  current: ColumnDefinition,
  next: ColumnDefinition,
): Map<string, string> {
  if (current.type !== 'select' || next.type !== 'select') {
    return new Map();
  }
  const newLabels = new Map(
    next.options.choices.map((choice) => [choice.id, choice.label]),
  );
  return new Map(
    current.options.choices.flatMap((choice) => {
      const label = newLabels.get(choice.id);
      return label !== undefined && label !== choice.label
        ? [[choice.label, label] as const]
        : [];
    }),
  );
}

/**
 * Rewrites the column's stored values so they fit its new definition and
 * returns how many cells had to be emptied.
 */
async function convertStoredValues(
  tx: Prisma.TransactionClient,
  tableId: string,
  current: TableColumn,
  next: ColumnDefinition,
): Promise<number> {
  // Select choices may have been renamed or removed even when the type stays.
  const sameRelation =
    current.type === 'relation' &&
    next.type === 'relation' &&
    current.options.tableId === next.options.tableId;
  if (sameRelation) {
    if (current.options.multiple !== next.options.multiple) {
      await switchLinkList(tx, tableId, current.id, next.options.multiple);
    }
    return 0;
  }
  if (
    current.type === next.type &&
    !['select', 'relation'].includes(next.type)
  ) {
    return 0;
  }

  const renames = choiceRenames(current, next);
  const rows = await tx.$queryRaw<{ id: string; value: unknown }[]>`
    SELECT id, data -> ${current.id}::text AS value
    FROM records
    WHERE "tableId" = ${tableId}::uuid AND data ? ${current.id}::text`;

  const changes: Record<string, CellValue> = {};
  let cleared = 0;
  for (const { id, value } of rows) {
    if (value === null) {
      continue;
    }
    const source =
      typeof value === 'string' ? (renames.get(value) ?? value) : value;
    // A record id means nothing once the column stops linking to its table.
    const converted =
      current.type === 'relation' ? null : convertCellValue(source, next);
    if (converted !== value) {
      changes[id] = converted;
      cleared += converted === null ? 1 : 0;
    }
  }

  if (Object.keys(changes).length > 0) {
    // One statement for every changed record; JSON null removes the key.
    await tx.$executeRaw`
      UPDATE records AS r
      SET data = CASE
        WHEN c.value = 'null'::jsonb THEN r.data - ${current.id}::text
        ELSE jsonb_set(r.data, ARRAY[${current.id}::text], c.value)
      END
      FROM jsonb_each(${JSON.stringify(changes)}::jsonb) AS c(id, value)
      WHERE r.id = c.id::uuid AND r."tableId" = ${tableId}::uuid`;
  }
  return cleared;
}

/**
 * Turns single links into lists of one, or lists into their first record:
 * a relation that stops being multiple keeps one link per record (ADR-032).
 */
async function switchLinkList(
  tx: Prisma.TransactionClient,
  tableId: string,
  columnId: string,
  multiple: boolean,
): Promise<void> {
  await (multiple
    ? tx.$executeRaw`
        UPDATE records
        SET data = jsonb_set(data, ARRAY[${columnId}::text],
                             jsonb_build_array(data -> ${columnId}::text))
        WHERE "tableId" = ${tableId}::uuid
          AND jsonb_typeof(data -> ${columnId}::text) = 'string'`
    : tx.$executeRaw`
        UPDATE records
        SET data = jsonb_set(data, ARRAY[${columnId}::text],
                             data -> ${columnId}::text -> 0)
        WHERE "tableId" = ${tableId}::uuid
          AND jsonb_typeof(data -> ${columnId}::text) = 'array'`);
}

async function withUniqueColumnName<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('A column with this name already exists');
    }
    throw error;
  }
}
