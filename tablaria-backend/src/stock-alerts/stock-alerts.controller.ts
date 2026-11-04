import { Controller, Get, Query } from '@nestjs/common';
import {
  type StockAlerts,
  type StockAlertsQuery,
  stockAlertsQuerySchema,
} from '@tablaria/shared';
import { CurrentUserId } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { StockAlertsService } from './stock-alerts.service';

@Controller('stock-alerts')
export class StockAlertsController {
  constructor(private readonly alerts: StockAlertsService) {}

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Query(new ZodValidationPipe(stockAlertsQuerySchema))
    query: StockAlertsQuery,
  ): Promise<StockAlerts> {
    return this.alerts.list(userId, query);
  }
}
