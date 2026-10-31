import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  canGroupRecordsBy,
  type ColumnType,
  FILTER_OPERATOR_BY_TYPE,
  type RecordColumn,
  type RecordFilter,
  type RecordListQuery,
} from '@tablaria/shared';
import { Prisma } from '../generated/prisma/client';
import type { LabelSource } from '../relations/relations';

export interface RecordQuerySql {
  where: Prisma.Sql;
  orderBy: Prisma.Sql;
  /** The grouped column's value as text, when the listing is grouped. */
  groupValue?: Prisma.Sql;
}

/**
 * Builds the WHERE and ORDER BY of a records listing. Every value travels as a
 * bound parameter, and column ids are only used after matching them against
 * the table's own columns, so user input never becomes SQL text.
 *
 * Relation columns are searched, filtered and sorted by the label of the
 * record they link to, and only those in `labels` (ADR-028).
 */
export function buildRecordQuery(
  tableId: string,
  columns: RecordColumn[],
  query: Pick<
    RecordListQuery,
    'search' | 'sort' | 'order' | 'filters' | 'group'
  >,
  labels: ReadonlyMap<string, LabelSource> = new Map(),
): RecordQuerySql {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const findColumn = (columnId: string) => {
    const column = byId.get(columnId);
    if (!column) {
      throw new BadRequestException(`Unknown column ${columnId}`);
    }
    // Computed per page in the API, not in SQL: not a filter or sort key yet (ADR-031).
    if (column.type === 'rollup') {
      throw new BadRequestException("Rollups can't be filtered or sorted yet");
    }
    return column;
  };
  /**
   * The cell as text: a relation's is its linked record's label, and a
   * lookup's the column it shows of that record.
   */
  const textOf = (column: RecordColumn): Prisma.Sql => {
    if (column.type !== 'relation' && column.type !== 'lookup') {
      return cellText(column);
    }
    const source = labels.get(column.id);
    if (!source) {
      throw new ForbiddenException('No access to the linked table');
    }
    return labelText(source);
  };
  const typeOf = (column: RecordColumn) =>
    labels.get(column.id)?.type ?? column.type;

  const conditions = [Prisma.sql`r."tableId" = ${tableId}::uuid`];

  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`;
    const searchable = columns.filter(
      ({ id, type }) =>
        type === 'text' ||
        type === 'select' ||
        (type === 'relation' && labels.has(id)) ||
        (type === 'lookup' &&
          ['text', 'select'].includes(labels.get(id)?.type ?? '')),
    );
    conditions.push(
      searchable.length > 0
        ? Prisma.sql`(${Prisma.join(
            searchable.map(
              (column) => Prisma.sql`${textOf(column)} ILIKE ${pattern}`,
            ),
            ' OR ',
          )})`
        : Prisma.sql`FALSE`,
    );
  }

  for (const filter of query.filters) {
    const column = findColumn(filter.columnId);
    conditions.push(filterCondition(column, filter, textOf(column)));
  }

  const direction = Prisma.raw(query.order === 'desc' ? 'DESC' : 'ASC');
  const sortColumn = query.sort ? findColumn(query.sort) : undefined;
  const orderBy = sortColumn
    ? Prisma.sql`${sortableValue(typeOf(sortColumn), textOf(sortColumn))} ${direction} NULLS LAST, r."createdAt" ASC, r.id ASC`
    : Prisma.sql`r."createdAt" ${direction}, r.id ${direction}`;

  if (!query.group) {
    return { where: Prisma.join(conditions, ' AND '), orderBy };
  }
  // Grouped: records come group by group, each group in the requested order.
  const groupColumn = findColumn(query.group);
  if (!canGroupRecordsBy(groupColumn)) {
    throw new BadRequestException(
      `Can't group by ${groupColumn.type === 'relation' ? 'multiple relation' : groupColumn.type} columns`,
    );
  }
  const groupValue = textOf(groupColumn);
  return {
    where: Prisma.join(conditions, ' AND '),
    orderBy: Prisma.sql`${groupOrder(groupColumn, groupValue)}, ${orderBy}`,
    groupValue,
  };
}

function filterCondition(
  column: RecordColumn,
  filter: RecordFilter,
  text: Prisma.Sql,
): Prisma.Sql {
  if (FILTER_OPERATOR_BY_TYPE[column.type] !== filter.op) {
    throw new BadRequestException(
      `Filter "${filter.op}" does not apply to ${column.type} columns`,
    );
  }

  switch (filter.op) {
    case 'contains':
      return Prisma.sql`${text} ILIKE ${`%${escapeLike(filter.value)}%`}`;
    case 'is':
      return Prisma.sql`${text}::boolean = ${filter.value}::boolean`;
    case 'in':
      return Prisma.sql`${text} IN (${Prisma.join(filter.values)})`;
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
      const value = Prisma.sql`${text}::${cast}`;
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

/**
 * A column of the record that a relation cell links to, as text. Relation
 * cells always hold a validated uuid, or a list of them when multiple: then
 * it is every linked record's, alphabetically and comma-separated (ADR-032).
 */
function labelText(source: LabelSource): Prisma.Sql {
  if (source.multiple) {
    return Prisma.sql`(SELECT string_agg(lr.data ->> ${source.columnId}::text, ', '
        ORDER BY lower(lr.data ->> ${source.columnId}::text))
      FROM records lr
      WHERE lr."tableId" = ${source.tableId}::uuid
        AND lr.id IN (SELECT jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(r.data -> ${source.viaColumnId}::text) = 'array'
               THEN r.data -> ${source.viaColumnId}::text END)::uuid))`;
  }
  return Prisma.sql`(SELECT lr.data ->> ${source.columnId}::text FROM records lr
    WHERE lr."tableId" = ${source.tableId}::uuid
      AND lr.id = (r.data ->> ${source.viaColumnId}::text)::uuid)`;
}

/** The cell cast to its type, so numbers and dates sort by value, not as text. */
function sortableValue(type: ColumnType, text: Prisma.Sql): Prisma.Sql {
  switch (type) {
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

/**
 * Groups in a natural order, empty last: a list in the order of its choices,
 * No before Yes, and text alphabetically. The exact value breaks ties, so two
 * spellings of a word ("Sí", "sí") never interleave.
 */
function groupOrder(column: RecordColumn, value: Prisma.Sql): Prisma.Sql {
  switch (column.type) {
    case 'select': {
      const labels = column.options.choices.map(({ label }) => label);
      return Prisma.sql`array_position(${labels}::text[], ${value}) ASC NULLS LAST`;
    }
    case 'boolean':
      return Prisma.sql`${value}::boolean ASC NULLS LAST`;
    default:
      return Prisma.sql`lower(${value}) ASC NULLS LAST, ${value} ASC`;
  }
}

/** Makes `%`, `_` and `\` match themselves in an ILIKE pattern. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}
