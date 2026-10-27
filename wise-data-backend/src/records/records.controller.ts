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
} from '@nestjs/common';
import {
  type Paginated,
  type RecordInput,
  recordInputSchema,
  type RecordListQuery,
  recordListQuerySchema,
  type TableRecord,
} from '@wisedata/shared';
import { CurrentUserId } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RecordsService } from './records.service';

@Controller('tables/:tableId/records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Query(new ZodValidationPipe(recordListQuerySchema)) query: RecordListQuery,
  ): Promise<Paginated<TableRecord>> {
    return this.records.list(userId, tableId, query);
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
