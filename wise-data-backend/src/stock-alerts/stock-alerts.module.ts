import { Module } from '@nestjs/common';
import { StockAlertsController } from './stock-alerts.controller';
import { StockAlertsService } from './stock-alerts.service';

@Module({
  controllers: [StockAlertsController],
  providers: [StockAlertsService],
})
export class StockAlertsModule {}
