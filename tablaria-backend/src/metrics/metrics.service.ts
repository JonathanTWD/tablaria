import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canMeasure,
  type ColumnSummary,
  CREATED_AT,
  type MetricGroup,
  type MetricGroups,
  type MetricGroupsQuery,
  type MetricsSummary,
  type TableColumn,
  type Timeline,
  TIMELINE_MAX_BUCKETS,
  type TimelineQuery,
} from '@tablaria/shared';
import { toTableColumn } from '../columns/column-mapper';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { labelSources, linkedLabels } from '../relations/relations';
import { accessibleTables } from '../tables/table-access';
import {
  findColumn,
  groupColumns,
  measureSql,
  summarizeGroups,
} from './metric-sql';

/**
 * A table's metrics (ADR-035), over all its records. Every column id comes
 * from the table itself and every value travels as a parameter.
 */
@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Total, average, minimum and maximum of every number column. */
  async summary(userId: string, tableId: string): Promise<MetricsSummary> {
    const { columns, total } = await this.table(userId, tableId);
    const measured = columns.filter(canMeasure);
    if (measured.length === 0) {
      return { total, columns: [] };
    }
    const rows = await this.prisma.$queryRaw<ColumnSummary[]>`
      SELECT c.id AS "columnId",
             count(x.value)::int AS filled,
             sum(x.value) AS sum, avg(x.value) AS avg,
             min(x.value) AS min, max(x.value) AS max
      FROM unnest(${measured.map(({ id }) => id)}::text[]) AS c(id)
      LEFT JOIN records r ON r."tableId" = ${tableId}::uuid
      CROSS JOIN LATERAL (
        SELECT CASE WHEN jsonb_typeof(r.data -> c.id) = 'number'
                    THEN (r.data ->> c.id)::float8 END AS value
      ) x
      GROUP BY c.id`;
    const byId = new Map(rows.map((row) => [row.columnId, row]));
    return {
      total,
      columns: measured.map(
        ({ id }) =>
          byId.get(id) ?? {
            columnId: id,
            filled: 0,
            sum: null,
            avg: null,
            min: null,
            max: null,
          },
      ),
    };
  }

  /** Records grouped by a column, counted or measured, the largest groups first. */
  async groups(
    userId: string,
    tableId: string,
    query: MetricGroupsQuery,
  ): Promise<MetricGroups> {
    const { columns, total } = await this.table(userId, tableId);
    const { groupBy, measured } = groupColumns(columns, query);
    // Linked records are named only for tables the user can open (ADR-028).
    if (
      groupBy.type === 'relation' &&
      !(await labelSources(this.prisma, userId, [groupBy])).has(groupBy.id)
    ) {
      throw new ForbiddenException('No access to the linked table');
    }
    const rows = await this.prisma.$queryRaw<
      (Omit<MetricGroup, 'count' | 'filled'> & {
        count: bigint;
        filled: bigint;
      })[]
    >`
      SELECT r.data -> ${groupBy.id}::text AS value,
             count(*) AS count,
             ${measureSql(measured, query.fn)}
      FROM records r
      WHERE r."tableId" = ${tableId}::uuid
      GROUP BY 1
      ORDER BY ${measured ? Prisma.sql`measure DESC NULLS LAST,` : Prisma.empty} 2 DESC, 1 ASC NULLS LAST`;
    const groups = rows.map((row) => ({
      ...row,
      count: Number(row.count),
      filled: Number(row.filled),
    }));
    const labels =
      groupBy.type === 'relation'
        ? await linkedLabels(
            this.prisma,
            userId,
            [groupBy],
            groups.map(({ value }) => ({ [groupBy.id]: value })),
          )
        : {};
    return summarizeGroups(groups, total, query.fn, labels);
  }

  /** Records per day, week or month, by when they were created or a date column. */
  async timeline(
    userId: string,
    tableId: string,
    query: TimelineQuery,
  ): Promise<Timeline> {
    const { columns } = await this.table(userId, tableId);
    const measured =
      query.column === undefined
        ? null
        : findColumn(columns, query.column, canMeasure, 'measured');
    const date =
      query.date === CREATED_AT
        ? Prisma.sql`r."createdAt"`
        : dateCell(
            findColumn(
              columns,
              query.date,
              ({ type }) => type === 'date',
              'date',
            ),
          );
    const rows = await this.prisma.$queryRaw<
      { start: string; count: bigint; filled: bigint; measure: number | null }[]
    >`
      SELECT to_char(date_trunc(${query.interval}, d.day), 'YYYY-MM-DD') AS start,
             count(*) AS count,
             ${measureSql(measured, query.fn)}
      FROM records r
      CROSS JOIN LATERAL (SELECT ${date}::timestamp AS day) d
      WHERE r."tableId" = ${tableId}::uuid AND d.day IS NOT NULL
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT ${TIMELINE_MAX_BUCKETS}`;
    return {
      buckets: rows.reverse().map((row) => ({
        ...row,
        count: Number(row.count),
        filled: Number(row.filled),
      })),
    };
  }

  private async table(
    userId: string,
    tableId: string,
  ): Promise<{ columns: TableColumn[]; total: number }> {
    const table = await this.prisma.inventoryTable.findFirst({
      where: { id: tableId, ...accessibleTables(userId) },
      select: {
        columns: { orderBy: { position: 'asc' } },
        _count: { select: { records: true } },
      },
    });
    if (!table) {
      throw new NotFoundException('Table not found');
    }
    return {
      columns: table.columns.map(toTableColumn),
      total: table._count.records,
    };
  }
}

/** A date cell of record `r`; NULL unless it holds an ISO date. */
function dateCell(column: TableColumn): Prisma.Sql {
  return Prisma.sql`(CASE WHEN r.data ->> ${column.id}::text ~ '^\\d{4}-\\d{2}-\\d{2}$'
                     THEN (r.data ->> ${column.id}::text)::date END)`;
}
