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
  columnDefinitionSchema,
  MAX_COLUMNS_PER_TABLE,
  type TableColumn,
  type UpdateColumnInput,
  type UpdateColumnResponse,
} from '@wisedata/shared';
import { parseOrThrow } from '../common/pipes/zod-validation.pipe';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { touchOwnedTable } from '../tables/table-access';
import { toColumnData, toTableColumn } from './column-mapper';
import { convertCellValue } from './convert-value';

@Injectable()
export class ColumnsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string, tableId: string): Promise<TableColumn[]> {
    const table = await this.prisma.inventoryTable.findFirst({
      where: { id: tableId, ownerId },
      select: { columns: { orderBy: { position: 'asc' } } },
    });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    return table.columns.map(toTableColumn);
  }

  create(
    ownerId: string,
    tableId: string,
    definition: ColumnDefinition,
  ): Promise<TableColumn> {
    return withUniqueColumnName(() =>
      this.prisma.$transaction(async (tx) => {
        await touchOwnedTable(tx, ownerId, tableId);

        const { _count, _max } = await tx.column.aggregate({
          where: { tableId },
          _count: true,
          _max: { position: true },
        });
        if (_count >= MAX_COLUMNS_PER_TABLE) {
          throw new UnprocessableEntityException('Column limit reached');
        }

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
        return toTableColumn(column);
      }),
    );
  }

  update(
    ownerId: string,
    tableId: string,
    columnId: string,
    patch: UpdateColumnInput,
  ): Promise<UpdateColumnResponse> {
    return withUniqueColumnName(() =>
      this.prisma.$transaction(async (tx) => {
        await touchOwnedTable(tx, ownerId, tableId);

        const stored = await tx.column.findFirst({
          where: { id: columnId, tableId },
        });
        if (!stored) {
          throw new NotFoundException('Column not found');
        }

        const current = toTableColumn(stored);
        const next = parseOrThrow(
          columnDefinitionSchema,
          mergeColumnPatch(current, patch),
        );
        const clearedValues = await convertStoredValues(
          tx,
          tableId,
          current,
          next,
        );
        const column = await tx.column.update({
          where: { id: columnId },
          data: toColumnData(next),
        });
        return { column: toTableColumn(column), clearedValues };
      }),
    );
  }

  reorder(
    ownerId: string,
    tableId: string,
    columnIds: string[],
  ): Promise<TableColumn[]> {
    return this.prisma.$transaction(async (tx) => {
      await touchOwnedTable(tx, ownerId, tableId);

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
  }

  async remove(
    ownerId: string,
    tableId: string,
    columnId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await touchOwnedTable(tx, ownerId, tableId);

      const { count } = await tx.column.deleteMany({
        where: { id: columnId, tableId },
      });
      if (count === 0) {
        throw new NotFoundException('Column not found');
      }
      await tx.$executeRaw`
        UPDATE records
        SET data = data - ${columnId}::text
        WHERE "tableId" = ${tableId}::uuid AND data ? ${columnId}::text`;
    });
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
    type: patch.type ?? current.type,
    options: keep('options', current.options),
    defaultValue: keep('defaultValue', current.defaultValue),
  };
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
  if (current.type === next.type && next.type !== 'select') {
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
    const converted = convertCellValue(source, next);
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
