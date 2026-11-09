import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  type Attachment,
  ATTACHMENT_MAX_BYTES,
  type AttachmentType,
  MAX_ATTACHMENTS_PER_RECORD,
  type RecordData,
  SPACE_ATTACHMENTS_MAX_BYTES,
} from '@tablaria/shared';
import { logActivity, recordLabel } from '../activity/activity-log';
import { toTableColumn } from '../columns/column-mapper';
import { PrismaService } from '../database/prisma.service';
import type {
  Prisma,
  Attachment as StoredAttachment,
} from '../generated/prisma/client';
import { accessibleTables, touchTable } from '../tables/table-access';
import { cleanFileName, detectAttachmentType } from './file-type';
import { FileStorage } from './storage/file-storage';

/** How often files of deleted records are removed from storage. */
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
/**
 * The periodic cleanup leaves recent rows alone: an upload commits its row
 * before the file reaches storage, and removing the row in between would
 * leave that file behind with nothing pointing at it.
 */
const CLEANUP_MIN_AGE_MS = 5 * 60 * 1000;
const CLEANUP_BATCH = 100;

/** What the API answers for a file: a link to the bucket, or the bytes. */
export type AttachmentFile =
  | { url: string }
  | { content: Buffer; name: string; contentType: AttachmentType };

/**
 * Photos and documents of a record (ADR-039). Rows are the source of truth;
 * a row without a record means its file still has to leave storage.
 */
@Injectable()
export class AttachmentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttachmentsService.name);
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
  ) {}

  onModuleInit(): void {
    this.cleanupTimer = setInterval(
      () =>
        void this.removeOrphans({
          uploadedBefore: new Date(Date.now() - CLEANUP_MIN_AGE_MS),
        }),
      CLEANUP_INTERVAL_MS,
    );
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  async list(
    userId: string,
    tableId: string,
    recordId: string,
  ): Promise<Attachment[]> {
    await this.requireRecord(userId, tableId, recordId);
    const rows = await this.prisma.attachment.findMany({
      where: { recordId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toAttachment);
  }

  async upload(
    userId: string,
    tableId: string,
    recordId: string,
    fileName: string | undefined,
    body: unknown,
  ): Promise<Attachment> {
    // The upload route reads the body raw; anything else means no file came.
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new BadRequestException('Send the file as the request body');
    }
    if (body.length > ATTACHMENT_MAX_BYTES) {
      throw new PayloadTooLargeException('File too large');
    }
    const contentType = detectAttachmentType(body);
    if (!contentType) {
      throw new UnsupportedMediaTypeException(
        'Only JPG, PNG, WebP and PDF files are allowed',
      );
    }

    const { attachment, label } = await this.prisma.$transaction(async (tx) => {
      await touchTable(tx, userId, tableId, 'EDITOR');
      const record = await tx.record.findFirst({
        where: { id: recordId, tableId },
        select: { data: true, table: { select: { organizationId: true } } },
      });
      if (!record) {
        throw new NotFoundException('Record not found');
      }
      // The quota is the space's: locking its row makes uploads to any of its
      // tables wait for each other, so none of them passes the limits on stale counts.
      await tx.$queryRaw`
        SELECT 1 FROM organizations
        WHERE id = ${record.table.organizationId}::uuid
        FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { demoExpiresAt: true },
      });
      // Anyone could otherwise store files for a day on the free plan.
      if (user.demoExpiresAt) {
        throw new ForbiddenException('Not available in the demo');
      }
      if (!this.storage.enabled) {
        throw new ServiceUnavailableException('Attachments are not available');
      }
      const count = await tx.attachment.count({ where: { recordId } });
      if (count >= MAX_ATTACHMENTS_PER_RECORD) {
        throw new UnprocessableEntityException('Attachment limit reached');
      }
      const {
        _sum: { size: used },
      } = await tx.attachment.aggregate({
        where: {
          record: {
            table: { organizationId: record.table.organizationId },
          },
        },
        _sum: { size: true },
      });
      if ((used ?? 0) + body.length > SPACE_ATTACHMENTS_MAX_BYTES) {
        throw new UnprocessableEntityException('Storage quota reached');
      }
      const created = await tx.attachment.create({
        data: {
          recordId,
          uploadedById: userId,
          name: cleanFileName(fileName),
          contentType,
          size: body.length,
        },
      });
      return {
        attachment: created,
        label: await labelOf(tx, tableId, record.data as RecordData),
      };
    });

    try {
      await this.storage.put(storageKey(attachment.id), body, contentType);
    } catch (error) {
      await this.prisma.attachment.delete({ where: { id: attachment.id } });
      throw error;
    }
    // Only once the file is stored: a failed upload leaves no trace in the history.
    // The file is saved by now, so a history hiccup is logged, not reported as a failed upload.
    try {
      await logActivity(this.prisma, {
        tableId,
        userId,
        action: 'attachment.added',
        recordId,
        label,
        details: { file: attachment.name },
      });
    } catch (error) {
      this.logger.warn(
        `Could not record the upload of attachment ${attachment.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return toAttachment(attachment);
  }

  async file(
    userId: string,
    tableId: string,
    recordId: string,
    attachmentId: string,
  ): Promise<AttachmentFile> {
    await this.requireRecord(userId, tableId, recordId);
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, recordId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    const { name, contentType } = toAttachment(attachment);
    const key = storageKey(attachment.id);
    const url = await this.storage.downloadUrl(key, { name, contentType });
    if (url) {
      return { url };
    }
    return { content: await this.storage.read(key), name, contentType };
  }

  async remove(
    userId: string,
    tableId: string,
    recordId: string,
    attachmentId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await touchTable(tx, userId, tableId, 'EDITOR');
      const attachment = await tx.attachment.findFirst({
        where: { id: attachmentId, recordId, record: { tableId } },
        select: { name: true, record: { select: { data: true } } },
      });
      if (!attachment?.record) {
        throw new NotFoundException('Attachment not found');
      }
      // Detached first: the file leaves storage below, or with the next cleanup.
      await tx.attachment.update({
        where: { id: attachmentId },
        data: { recordId: null },
      });
      await logActivity(tx, {
        tableId,
        userId,
        action: 'attachment.removed',
        recordId,
        label: await labelOf(tx, tableId, attachment.record.data as RecordData),
        details: { file: attachment.name },
      });
    });
    await this.removeOrphans({ ids: [attachmentId] });
  }

  /**
   * Removes the files whose record is gone, and then their rows. A file that
   * cannot be removed now keeps its row, so the next cleanup tries again.
   */
  async removeOrphans({
    ids,
    uploadedBefore,
  }: { ids?: string[]; uploadedBefore?: Date } = {}): Promise<void> {
    // Pages through every orphan, so files that keep failing never hide the rest.
    let cursor: string | undefined;
    for (;;) {
      const orphans = await this.prisma.attachment.findMany({
        where: {
          recordId: null,
          id: { ...(ids && { in: ids }), ...(cursor && { gt: cursor }) },
          ...(uploadedBefore && { createdAt: { lt: uploadedBefore } }),
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: CLEANUP_BATCH,
      });
      for (const { id } of orphans) {
        try {
          await this.storage.delete(storageKey(id));
          await this.prisma.attachment.delete({ where: { id } });
        } catch (error) {
          this.logger.warn(
            `Could not remove attachment ${id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      if (orphans.length < CLEANUP_BATCH) {
        return;
      }
      cursor = orphans[orphans.length - 1].id;
    }
  }

  /** 404 alike for a missing table, one without access and a record of another table. */
  private async requireRecord(
    userId: string,
    tableId: string,
    recordId: string,
  ): Promise<void> {
    const record = await this.prisma.record.findFirst({
      where: { id: recordId, tableId, table: accessibleTables(userId) },
      select: { id: true },
    });
    if (!record) {
      throw new NotFoundException('Record not found');
    }
  }
}

/** The record's name as the history shows it (its first column). */
async function labelOf(
  tx: Prisma.TransactionClient,
  tableId: string,
  data: RecordData,
): Promise<string | null> {
  const first = await tx.column.findFirst({
    where: { tableId },
    orderBy: { position: 'asc' },
  });
  return recordLabel(first ? toTableColumn(first) : undefined, data);
}

function storageKey(attachmentId: string): string {
  return `attachments/${attachmentId}`;
}

function toAttachment(row: StoredAttachment): Attachment {
  return {
    id: row.id,
    name: row.name,
    // Only detected types are ever stored.
    contentType: row.contentType as AttachmentType,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
  };
}
