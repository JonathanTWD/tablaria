import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type RecordInput,
  type RecordPage,
  recordInputSchema,
  type RecordExportQuery,
  recordExportQuerySchema,
  type RecordListQuery,
  recordListQuerySchema,
  type TableRecord,
} from '@tablaria/shared';
import { CurrentUserId } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { Response } from 'express';
import { RecordsService } from './records.service';

/** Exports read a whole table, so they get a tighter limit than the API default. */
const EXPORT_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('tables/:tableId/records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Query(new ZodValidationPipe(recordListQuerySchema)) query: RecordListQuery,
  ): Promise<RecordPage> {
    return this.records.list(userId, tableId, query);
  }

  // Declared before any ':recordId' route so "export" is never read as an id.
  @Get('export')
  @Throttle(EXPORT_THROTTLE)
  async export(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Query(new ZodValidationPipe(recordExportQuerySchema))
    query: RecordExportQuery,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.records.export(userId, tableId, query);
    response.set({
      'Content-Type': file.contentType,
      // ASCII-only name, so no RFC 5987 encoding is needed.
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(file.content);
  }

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body(new ZodValidationPipe(recordInputSchema)) body: RecordInput,
  ): Promise<TableRecord> {
    return this.records.create(userId, tableId, body);
  }

  @Patch(':recordId')
  update(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body(new ZodValidationPipe(recordInputSchema)) body: RecordInput,
  ): Promise<TableRecord> {
    return this.records.update(userId, tableId, recordId, body);
  }

  @Delete(':recordId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
  ): Promise<void> {
    return this.records.remove(userId, tableId, recordId);
  }
}
