import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  type StockEntry,
  stockEntrySchema,
  type StockHistory,
  type StockHistoryQuery,
  stockHistoryQuerySchema,
  type StockMovement,
  type TableRecord,
} from '@wisedata/shared';
import { CurrentUserId } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { StockMovementsService } from './stock-movements.service';

@Controller('tables/:tableId/records/:recordId/movements')
export class StockMovementsController {
  constructor(private readonly movements: StockMovementsService) {}

  @Get()
  history(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Query(new ZodValidationPipe(stockHistoryQuerySchema))
    query: StockHistoryQuery,
  ): Promise<StockHistory> {
    return this.movements.history(userId, tableId, recordId, query);
  }

  @Post()
  record(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body(new ZodValidationPipe(stockEntrySchema)) entry: StockEntry,
  ): Promise<{ movement: StockMovement; record: TableRecord }> {
    return this.movements.record(userId, tableId, recordId, entry);
  }
}
