import type { RecordData } from '@wisedata/shared';
import type { Prisma } from '../generated/prisma/client';

/** Empty cells are stored as absent keys, never as null. */
export function withoutEmptyCells(data: RecordData): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== null),
  );
}
