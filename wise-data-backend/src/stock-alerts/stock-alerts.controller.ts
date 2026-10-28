import { Controller, Get } from '@nestjs/common';
import type { StockAlerts } from '@wisedata/shared';
import { CurrentUserId } from '../auth/decorators';
import { StockAlertsService } from './stock-alerts.service';

@Controller('stock-alerts')
export class StockAlertsController {
  constructor(private readonly alerts: StockAlertsService) {}

  @Get()
  list(@CurrentUserId() userId: string): Promise<StockAlerts> {
    return this.alerts.list(userId);
  }
}
