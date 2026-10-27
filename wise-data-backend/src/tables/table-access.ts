import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';

/**
 * Marks a table as edited now and, as a side effect of the update, locks its
 * row until the transaction ends, so changes to its columns never interleave.
 * Tables of other users answer 404, exactly like missing ones.
 */
export async function touchOwnedTable(
  tx: Prisma.TransactionClient,
  ownerId: string,
  tableId: string,
): Promise<void> {
  const { count } = await tx.inventoryTable.updateMany({
    where: { id: tableId, ownerId },
    data: { updatedAt: new Date() },
  });
  if (count === 0) {
    throw new NotFoundException('Table not found');
  }
}
