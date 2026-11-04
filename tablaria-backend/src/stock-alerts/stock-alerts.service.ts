import { Injectable } from '@nestjs/common';
import {
  STOCK_ALERTS_LIMIT,
  type StockAlert,
  type StockAlerts,
  type StockAlertsQuery,
} from '@tablaria/shared';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class StockAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records below their column's threshold in every table the user can open,
   * or only in the one asked for (a table's metrics, ADR-035).
   */
  async list(userId: string, query: StockAlertsQuery): Promise<StockAlerts> {
    const rows = await this.prisma.$queryRaw<
      (StockAlert & { total: bigint })[]
    >`
      SELECT "recordId", "tableId", "tableName", "columnName", label, value, "alertBelow",
             count(*) OVER () AS total
      FROM ${candidates(userId, query.tableId)}
      WHERE value < "alertBelow"
      ORDER BY value ASC, "createdAt" ASC
      LIMIT ${STOCK_ALERTS_LIMIT}`;

    return {
      total: Number(rows[0]?.total ?? 0),
      items: rows.map((row) => ({
        tableId: row.tableId,
        tableName: row.tableName,
        recordId: row.recordId,
        label: row.label,
        columnName: row.columnName,
        value: row.value,
        alertBelow: row.alertBelow,
      })),
    };
  }
}

/**
 * Every number cell of a column with a threshold, with what names it, in the
 * tables the user can open. The CASE keeps the cast away from cells that are
 * not numbers, whatever order the planner applies the conditions in.
 */
function candidates(userId: string, tableId?: string): Prisma.Sql {
  return Prisma.sql`(
    SELECT r.id AS "recordId",
           r."createdAt",
           t.id AS "tableId",
           t.name AS "tableName",
           c.name AS "columnName",
           r.data ->> first.id::text AS label,
           CASE WHEN jsonb_typeof(r.data -> c.id::text) = 'number'
                THEN (r.data ->> c.id::text)::float8 END AS value,
           (c.options ->> 'alertBelow')::float8 AS "alertBelow"
    FROM inventory_tables t
    JOIN columns c ON c."tableId" = t.id
    JOIN records r ON r."tableId" = t.id
    -- The first column usually names the record (product, equipment…).
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
      AND c.type = 'number'
      AND c.options ? 'alertBelow'
  ) alerts`;
}
