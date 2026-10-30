import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type RecordData,
  STOCK_HISTORY_LIMIT,
  type StockEntry,
  type StockHistory,
  type StockHistoryQuery,
  type StockMovement,
  type StockMovementKind,
  type TableRecord,
} from '@wisedata/shared';
import { displayName } from '../common/display-name';
import { PrismaService } from '../database/prisma.service';
import type {
  Prisma,
  StockMovementKind as StoredKind,
} from '../generated/prisma/client';
import { RealtimeService } from '../realtime/realtime.service';
import { toTableRecord } from '../records/record-data';
import { requireTableRole, touchTable } from '../tables/table-access';
import { roundUnits, units } from './stock-log';

const KINDS: Record<StockEntry['kind'], StoredKind> = {
  in: 'IN',
  out: 'OUT',
  count: 'COUNT',
};

const withAuthor = {
  user: { select: { email: true, demoExpiresAt: true } },
} satisfies Prisma.StockMovementInclude;

type MovementRow = Prisma.StockMovementGetPayload<{
  include: typeof withAuthor;
}>;

@Injectable()
export class StockMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async history(
    userId: string,
    tableId: string,
    recordId: string,
    query: StockHistoryQuery,
  ): Promise<StockHistory> {
    await requireTableRole(this.prisma, userId, tableId, 'VIEWER');
    const record = await this.prisma.record.findFirst({
      where: { id: recordId, tableId },
      select: { id: true },
    });
    if (!record) {
      throw new NotFoundException('Record not found');
    }
    const where = { recordId, columnId: query.columnId };
    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: withAuthor,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: STOCK_HISTORY_LIMIT,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { data: movements.map(toStockMovement), total };
  }

  /** Goods in or out, or a recount, applied to the record's stock. */
  async record(
    userId: string,
    tableId: string,
    recordId: string,
    entry: StockEntry,
  ): Promise<{ movement: StockMovement; record: TableRecord }> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Edits of the same table wait, so the stock read below stays current.
      await touchTable(tx, userId, tableId, 'EDITOR');
      const column = await tx.column.findFirst({
        where: { id: entry.columnId, tableId },
      });
      if (!column) {
        throw new NotFoundException('Column not found');
      }
      if (!column.stock) {
        throw new BadRequestException('Column does not track stock');
      }
      const stored = await tx.record.findFirst({
        where: { id: recordId, tableId },
      });
      if (!stored) {
        throw new NotFoundException('Record not found');
      }

      const data = stored.data as RecordData;
      const current = units(data[column.id]);
      const balance = roundUnits(
        entry.kind === 'in'
          ? current + entry.quantity
          : entry.kind === 'out'
            ? current - entry.quantity
            : entry.quantity,
      );
      if (balance < 0) {
        throw new UnprocessableEntityException('Not enough stock');
      }
      const record = await tx.record.update({
        where: { id: recordId },
        data: { data: { ...data, [column.id]: balance } },
      });
      const movement = await tx.stockMovement.create({
        data: {
          tableId,
          recordId,
          columnId: column.id,
          userId,
          kind: KINDS[entry.kind],
          delta: roundUnits(balance - current),
          balance,
          note: entry.note,
        },
        include: withAuthor,
      });
      return {
        movement: toStockMovement(movement),
        record: toTableRecord(record),
      };
    });
    this.realtime.publish(tableId, 'records');
    return result;
  }
}

function toStockMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    recordId: row.recordId,
    columnId: row.columnId,
    kind: row.kind.toLowerCase() as StockMovementKind,
    delta: row.delta,
    balance: row.balance,
    note: row.note,
    by: row.user ? displayName(row.user) : null,
    createdAt: row.createdAt.toISOString(),
  };
}
