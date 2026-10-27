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
} from '@nestjs/common';
import {
  createTableSchema,
  type TableDetail,
  type TableSummary,
  updateTableSchema,
} from '@wisedata/shared';
import type { z } from 'zod';
import { CurrentUserId } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TablesService } from './tables.service';

@Controller('tables')
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Get()
  list(@CurrentUserId() userId: string): Promise<TableSummary[]> {
    return this.tables.list(userId);
  }

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(createTableSchema))
    body: z.output<typeof createTableSchema>,
  ): Promise<TableDetail> {
    return this.tables.create(userId, body);
  }

  @Get(':tableId')
  get(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ): Promise<TableDetail> {
    return this.tables.get(userId, tableId);
  }

  @Patch(':tableId')
  update(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body(new ZodValidationPipe(updateTableSchema))
    body: z.output<typeof updateTableSchema>,
  ): Promise<TableDetail> {
    return this.tables.update(userId, tableId, body);
  }

  @Delete(':tableId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ): Promise<void> {
    return this.tables.remove(userId, tableId);
  }
}
