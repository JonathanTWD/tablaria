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
  type ColumnDefinition,
  columnDefinitionSchema,
  type ReorderColumnsInput,
  reorderColumnsSchema,
  type TableColumn,
  type UpdateColumnInput,
  type UpdateColumnResponse,
  updateColumnSchema,
} from '@wisedata/shared';
import { CurrentUserId } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ColumnsService } from './columns.service';

@Controller('tables/:tableId/columns')
export class ColumnsController {
  constructor(private readonly columns: ColumnsService) {}

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ): Promise<TableColumn[]> {
    return this.columns.list(userId, tableId);
  }

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body(new ZodValidationPipe(columnDefinitionSchema)) body: ColumnDefinition,
  ): Promise<TableColumn> {
    return this.columns.create(userId, tableId, body);
  }

  // Declared before ':columnId' so "order" is never read as a column id.
  @Patch('order')
  reorder(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body(new ZodValidationPipe(reorderColumnsSchema))
    body: ReorderColumnsInput,
  ): Promise<TableColumn[]> {
    return this.columns.reorder(userId, tableId, body.columnIds);
  }

  @Patch(':columnId')
  update(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @Body(new ZodValidationPipe(updateColumnSchema)) body: UpdateColumnInput,
  ): Promise<UpdateColumnResponse> {
    return this.columns.update(userId, tableId, columnId, body);
  }

  @Delete(':columnId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('columnId', ParseUUIDPipe) columnId: string,
  ): Promise<void> {
    return this.columns.remove(userId, tableId, columnId);
  }
}
