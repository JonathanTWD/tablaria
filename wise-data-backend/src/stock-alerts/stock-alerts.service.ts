import { Injectable } from '@nestjs/common';
import {
  STOCK_ALERTS_LIMIT,
  type StockAlert,
  type StockAlerts,
} from '@wisedata/shared';
import { toTableColumn } from '../columns/column-mapper';
import { PrismaService } from '../database/prisma.service';

interface AlertRow {
  id: string;
  label: string | null;
  value: number;
  total: bigint;
}

@Injectable()
export class StockAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Records below their column's threshold in every table the user owns. */
  async list(ownerId: string): Promise<StockAlerts> {
    const numberColumns = await this.prisma.column.findMany({
      where: { type: 'number', table: { ownerId } },
      include: {
        table: {
          select: {
            name: true,
            // The first column usually names the record (product, equipment…).
            columns: {
              orderBy: { position: 'asc' },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });

    const watched = numberColumns.flatMap((stored) => {
      const column = toTableColumn(stored);
      return column.type === 'number' && column.options
        ? [{ stored, alertBelow: column.options.alertBelow }]
        : [];
    });

    // One small query per watched column; a user has at most a few of them.
    const results = await Promise.all(
      watched.map(async ({ stored, alertBelow }) => {
        const labelId = stored.table.columns[0]?.id ?? stored.id;
        const rows = await this.prisma.$queryRaw<AlertRow[]>`
          SELECT r.id,
                 (r.data ->> ${labelId}::text) AS label,
                 (r.data ->> ${stored.id}::text)::float8 AS value,
                 count(*) OVER () AS total
          FROM records r
          WHERE r."tableId" = ${stored.tableId}::uuid
            AND r.data ? ${stored.id}::text
            AND (r.data ->> ${stored.id}::text)::float8 < ${alertBelow}
          ORDER BY value ASC, r."createdAt" ASC
          LIMIT ${STOCK_ALERTS_LIMIT}`;

        const items: StockAlert[] = rows.map((row) => ({
          tableId: stored.tableId,
          tableName: stored.table.name,
          recordId: row.id,
          label: row.label,
          columnName: stored.name,
          value: row.value,
          alertBelow,
        }));
        return { items, total: Number(rows[0]?.total ?? 0) };
      }),
    );

    return {
      total: results.reduce((sum, { total }) => sum + total, 0),
      items: results
        .flatMap(({ items }) => items)
        .sort((a, b) => a.value - b.value)
        .slice(0, STOCK_ALERTS_LIMIT),
    };
  }
}
