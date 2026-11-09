import type {
  ActivityAction,
  ActivityDetails,
  RecordColumn,
  RecordData,
} from '@tablaria/shared';
import type {
  ActivityAction as StoredAction,
  Prisma,
} from '../generated/prisma/client';

export const STORED_ACTIONS: Record<ActivityAction, StoredAction> = {
  'record.created': 'RECORD_CREATED',
  'record.updated': 'RECORD_UPDATED',
  'record.deleted': 'RECORD_DELETED',
  'records.imported': 'RECORDS_IMPORTED',
  'column.created': 'COLUMN_CREATED',
  'column.updated': 'COLUMN_UPDATED',
  'column.deleted': 'COLUMN_DELETED',
  'stock.moved': 'STOCK_MOVED',
  'attachment.added': 'ATTACHMENT_ADDED',
  'attachment.removed': 'ATTACHMENT_REMOVED',
};

/** Edits of one record by one person this close together read as one. */
const MERGE_WINDOW_MS = 5 * 60_000;
const LABEL_MAX_LENGTH = 200;

/**
 * A record's name as the history shows it: its first column (by position),
 * when that holds text, a number or a date.
 */
export function recordLabel(
  first: RecordColumn | undefined,
  data: RecordData,
): string | null {
  const value = first && first.type !== 'relation' ? data[first.id] : null;
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).slice(0, LABEL_MAX_LENGTH)
    : null;
}

/** Names of the columns whose value differs between two versions of a record. */
export function changedColumns(
  columns: RecordColumn[],
  before: RecordData,
  after: RecordData,
): string[] {
  return (
    columns
      // Lists (multiple relations) compare by their contents.
      .filter(
        ({ id }) =>
          JSON.stringify(before[id] ?? null) !==
          JSON.stringify(after[id] ?? null),
      )
      .map(({ name }) => name)
  );
}

/**
 * Adds an event to the table's history (ADR-025). Call inside the write's
 * transaction, after touchTable: the table lock keeps the merge below safe.
 */
export async function logActivity(
  tx: Prisma.TransactionClient,
  event: {
    tableId: string;
    userId: string;
    action: ActivityAction;
    recordId?: string;
    label?: string | null;
    details?: ActivityDetails;
  },
): Promise<void> {
  const { tableId, userId, action, recordId = null, label = null } = event;
  const details = event.details ?? {};
  if (action === 'record.updated') {
    const last = await tx.activityEvent.findFirst({
      where: { tableId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (
      last?.action === 'RECORD_UPDATED' &&
      last.recordId === recordId &&
      last.userId === userId &&
      Date.now() - last.createdAt.getTime() < MERGE_WINDOW_MS
    ) {
      const earlier = (last.details as ActivityDetails).columns ?? [];
      const columns = [...new Set([...earlier, ...(details.columns ?? [])])];
      await tx.activityEvent.update({
        where: { id: last.id },
        data: { label, details: { columns }, createdAt: new Date() },
      });
      return;
    }
  }
  await tx.activityEvent.create({
    data: {
      tableId,
      userId,
      action: STORED_ACTIONS[action],
      recordId,
      label: label?.slice(0, LABEL_MAX_LENGTH) ?? null,
      details: details as Prisma.InputJsonObject,
    },
  });
}
