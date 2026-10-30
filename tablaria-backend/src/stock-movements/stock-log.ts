import type { CellValue, RecordColumn, RecordData } from '@tablaria/shared';
import type { Prisma, StockMovementKind } from '../generated/prisma/client';

/** A record's cells before and after a write. */
export interface RecordWrite {
  id: string;
  before: RecordData;
  after: RecordData;
}

/** Drops float noise such as 0.1 + 0.2 = 0.30000000000000004. */
export function roundUnits(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** An empty stock cell counts as zero units. */
export function units(value: CellValue | undefined): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * Keeps each change of a stock column as a movement (ADR-024), so a record's
 * history adds up to its stock whatever changed it. Call inside the write's
 * transaction.
 */
export async function logStockChanges(
  tx: Prisma.TransactionClient,
  {
    tableId,
    userId,
    kind,
    note = null,
    columns,
    writes,
  }: {
    tableId: string;
    userId: string;
    kind: StockMovementKind;
    note?: string | null;
    columns: RecordColumn[];
    writes: RecordWrite[];
  },
): Promise<void> {
  const stockColumns = columns.filter((column) => column.stock);
  const data = writes.flatMap(({ id, before, after }) =>
    stockColumns.flatMap((column) => {
      const balance = units(after[column.id]);
      const delta = roundUnits(balance - units(before[column.id]));
      return delta === 0
        ? []
        : [
            {
              tableId,
              recordId: id,
              columnId: column.id,
              userId,
              kind,
              delta,
              balance,
              note,
            },
          ];
    }),
  );
  if (data.length > 0) {
    await tx.stockMovement.createMany({ data });
  }
}
