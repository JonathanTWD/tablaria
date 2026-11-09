import { Injectable } from '@nestjs/common';
import {
  UPCOMING_DATES_LIMIT,
  type UpcomingDate,
  type UpcomingDates,
  type UpcomingDatesQuery,
} from '@tablaria/shared';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class UpcomingDatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dates from today to their column's warning (`alertDaysBefore` days ahead)
   * in every table the user can open, or only in the one asked for (ADR-048).
   */
  async list(
    userId: string,
    query: UpcomingDatesQuery,
  ): Promise<UpcomingDates> {
    const rows = await this.prisma.$queryRaw<
      (Omit<UpcomingDate, 'date'> & { date: Date; total: bigint })[]
    >`
      SELECT "recordId", "tableId", "tableName", "columnName", label, date,
             (date - ${query.today}::date) AS "daysLeft",
             count(*) OVER () AS total
      FROM ${candidates(userId, query.tableId)}
      WHERE date >= ${query.today}::date
        AND date <= ${query.today}::date + "alertDaysBefore"
      ORDER BY date ASC, "createdAt" ASC
      LIMIT ${UPCOMING_DATES_LIMIT}`;

    return {
      total: Number(rows[0]?.total ?? 0),
      items: rows.map((row) => ({
        tableId: row.tableId,
        tableName: row.tableName,
        recordId: row.recordId,
        label: row.label,
        columnName: row.columnName,
        date: row.date.toISOString().slice(0, 10),
        daysLeft: Number(row.daysLeft),
      })),
    };
  }
}

/**
 * Every date cell of a column with a warning, with what names it, in the
 * tables the user can open. The CASE keeps the cast away from cells that are
 * not ISO days, whatever order the planner applies the conditions in.
 */
function candidates(userId: string, tableId?: string): Prisma.Sql {
  return Prisma.sql`(
    SELECT r.id AS "recordId",
           r."createdAt",
           t.id AS "tableId",
           t.name AS "tableName",
           c.name AS "columnName",
           r.data ->> first.id::text AS label,
           CASE WHEN jsonb_typeof(r.data -> c.id::text) = 'string'
                 AND (r.data ->> c.id::text) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                THEN (r.data ->> c.id::text)::date END AS date,
           (c.options ->> 'alertDaysBefore')::int AS "alertDaysBefore"
    FROM inventory_tables t
    JOIN columns c ON c."tableId" = t.id
    JOIN records r ON r."tableId" = t.id
    -- The first column usually names the record (order, equipment…).
    CROSS JOIN LATERAL (
      SELECT id FROM columns WHERE "tableId" = t.id ORDER BY position LIMIT 1
    ) first
    -- Same rule as accessibleTables(): a member of its organization or shared with.
    WHERE (
      EXISTS (
        SELECT 1 FROM memberships m
        WHERE m."organizationId" = t."organizationId" AND m."userId" = ${userId}::uuid
      )
      OR EXISTS (
        SELECT 1 FROM table_shares s
        WHERE s."tableId" = t.id AND s."userId" = ${userId}::uuid
      )
    )
      ${tableId ? Prisma.sql`AND t.id = ${tableId}::uuid` : Prisma.empty}
      AND c.type = 'date'
      AND c.options ? 'alertDaysBefore'
  ) upcoming`;
}
