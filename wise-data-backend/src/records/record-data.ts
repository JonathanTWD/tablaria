import type { RecordData } from '@wisedata/shared';
import type { Prisma } from '../generated/prisma/client';

/** Empty cells are stored as absent keys, never as null. */
export function withoutEmptyCells(data: RecordData): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== null),
  );
}

/**
 * Rows inserted together keep their order: records sort by createdAt, and a
 * single createMany would give them all the same instant (then the random id
 * decides). Each row gets the next millisecond.
 */
export function inInsertionOrder<T extends object>(
  rows: T[],
  start = new Date(),
): (T & { createdAt: Date })[] {
  return rows.map((row, index) => ({
    ...row,
    createdAt: new Date(start.getTime() + index),
  }));
}
