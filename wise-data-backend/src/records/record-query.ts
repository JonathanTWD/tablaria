import { BadRequestException } from '@nestjs/common';
import {
  FILTER_OPERATOR_BY_TYPE,
  type RecordColumn,
  type RecordFilter,
  type RecordListQuery,
} from '@wisedata/shared';
import { Prisma } from '../generated/prisma/client';

export interface RecordQuerySql {
  where: Prisma.Sql;
  orderBy: Prisma.Sql;
}

/**
 * Builds the WHERE and ORDER BY of a records listing. Every value travels as a
 * bound parameter, and column ids are only used after matching them against
 * the table's own columns, so user input never becomes SQL text.
 */
export function buildRecordQuery(
  tableId: string,
  columns: RecordColumn[],
  query: Pick<RecordListQuery, 'search' | 'sort' | 'order' | 'filters'>,
): RecordQuerySql {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const findColumn = (columnId: string) => {
    const column = byId.get(columnId);
    if (!column) {
      throw new BadRequestException(`Unknown column ${columnId}`);
    }
    return column;
  };

  const conditions = [Prisma.sql`r."tableId" = ${tableId}::uuid`];

  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`;
    const searchable = columns.filter(
      ({ type }) => type === 'text' || type === 'select',
    );
    conditions.push(
      searchable.length > 0
        ? Prisma.sql`(${Prisma.join(
            searchable.map(
              (column) => Prisma.sql`${cellText(column)} ILIKE ${pattern}`,
            ),
            ' OR ',
          )})`
        : Prisma.sql`FALSE`,
    );
  }

  for (const filter of query.filters) {
    conditions.push(filterCondition(findColumn(filter.columnId), filter));
  }

  const direction = Prisma.raw(query.order === 'desc' ? 'DESC' : 'ASC');
  const orderBy = query.sort
    ? Prisma.sql`${sortableValue(findColumn(query.sort))} ${direction} NULLS LAST, r."createdAt" ASC, r.id ASC`
    : Prisma.sql`r."createdAt" ${direction}, r.id ${direction}`;

  return { where: Prisma.join(conditions, ' AND '), orderBy };
}

function filterCondition(
  column: RecordColumn,
  filter: RecordFilter,
): Prisma.Sql {
  if (FILTER_OPERATOR_BY_TYPE[column.type] !== filter.op) {
    throw new BadRequestException(
      `Filter "${filter.op}" does not apply to ${column.type} columns`,
    );
  }

  switch (filter.op) {
    case 'contains':
      return Prisma.sql`${cellText(column)} ILIKE ${`%${escapeLike(filter.value)}%`}`;
    case 'is':
      return Prisma.sql`${cellText(column)}::boolean = ${filter.value}::boolean`;
    case 'in':
      return Prisma.sql`${cellText(column)} IN (${Prisma.join(filter.values)})`;
    case 'between': {
      const cast = Prisma.raw(column.type === 'date' ? 'date' : 'numeric');
      const bounds = [filter.min, filter.max];
      const expected = column.type === 'date' ? 'string' : 'number';
      if (
        bounds.some((bound) => bound !== undefined && typeof bound !== expected)
      ) {
        throw new BadRequestException(
          `Range bounds of ${column.type} columns must be ${column.type === 'date' ? 'ISO dates' : 'numbers'}`,
        );
      }
      const value = Prisma.sql`${cellText(column)}::${cast}`;
      const parts = [
        filter.min !== undefined &&
          Prisma.sql`${value} >= ${filter.min}::${cast}`,
        filter.max !== undefined &&
          Prisma.sql`${value} <= ${filter.max}::${cast}`,
      ].filter((part): part is Prisma.Sql => part !== false);
      return Prisma.join(parts, ' AND ');
    }
  }
}

/** The cell as text (`->>`), or NULL when the record has no value. */
function cellText(column: RecordColumn): Prisma.Sql {
  return Prisma.sql`(r.data ->> ${column.id}::text)`;
}

/** The cell cast to its type, so numbers and dates sort by value, not as text. */
function sortableValue(column: RecordColumn): Prisma.Sql {
  const text = cellText(column);
  switch (column.type) {
    case 'number':
    case 'currency':
      return Prisma.sql`${text}::numeric`;
    case 'date':
      return Prisma.sql`${text}::date`;
    case 'boolean':
      return Prisma.sql`${text}::boolean`;
    default:
      return Prisma.sql`lower(${text})`;
  }
}

/** Makes `%`, `_` and `\` match themselves in an ILIKE pattern. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}
