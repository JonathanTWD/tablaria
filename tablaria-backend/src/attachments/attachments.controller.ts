import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type Attachment, isImageAttachment } from '@tablaria/shared';
import type { Response } from 'express';
import { CurrentUserId } from '../auth/decorators';
import { AttachmentsService } from './attachments.service';
import { contentDisposition } from './storage/s3.storage';

/** Each upload carries up to a whole file. */
const UPLOAD_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

@Controller('tables/:tableId/records/:recordId/attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
  ): Promise<Attachment[]> {
    return this.attachments.list(userId, tableId, recordId);
  }

  /** The file itself is the body (see app.setup); its name goes in `?name=`. */
  @Post()
  @Throttle(UPLOAD_THROTTLE)
  upload(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Query('name') name: unknown,
    @Body() body: unknown,
  ): Promise<Attachment> {
    return this.attachments.upload(
      userId,
      tableId,
      recordId,
      typeof name === 'string' ? name : undefined,
      body,
    );
  }

  /** Redirects to a short-lived link to the bucket, or serves the file in development. */
  @Get(':attachmentId')
  async file(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile | undefined> {
    const file = await this.attachments.file(
      userId,
      tableId,
      recordId,
      attachmentId,
    );
    // Shorter than the signed link's life, so a cached redirect still works.
    response.set('Cache-Control', 'private, max-age=240');
    if ('url' in file) {
      response.redirect(HttpStatus.FOUND, file.url);
      return undefined;
    }
    response.set({
      'Content-Type': file.contentType,
      'Content-Disposition': contentDisposition(file.name),
    });
    if (isImageAttachment(file.contentType)) {
      // An image opened on its own never runs anything in the API's origin.
      // Not for PDFs: Chrome refuses to show them in a sandbox.
      response.set('Content-Security-Policy', "default-src 'none'; sandbox");
    }
    return new StreamableFile(file.content);
  }

  @Delete(':attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ): Promise<void> {
    return this.attachments.remove(userId, tableId, recordId, attachmentId);
  }
}
