import { Injectable } from '@nestjs/common';
import {
  STOCK_ALERTS_LIMIT,
  type StockAlert,
  type StockAlerts,
} from '@wisedata/shared';
import { PrismaService } from '../database/prisma.service';

type AlertRow = StockAlert & { total: bigint };

@Injectable()
export class StockAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Records below their column's threshold in every table the user owns. */
  async list(ownerId: string): Promise<StockAlerts> {
    // The CASE keeps the cast away from cells that are not numbers, whatever
    // order the planner applies the conditions in.
    const rows = await this.prisma.$queryRaw<AlertRow[]>`
      SELECT "recordId", "tableId", "tableName", "columnName", label, value,
             "alertBelow", count(*) OVER () AS total
      FROM (
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
        WHERE t."ownerId" = ${ownerId}::uuid
          AND c.type = 'number'
          AND c.options ? 'alertBelow'
      ) candidates
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
