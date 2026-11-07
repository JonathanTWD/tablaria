import { Module } from '@nestjs/common';
import { StockAlertsController } from './stock-alerts.controller';
import { StockAlertsService } from './stock-alerts.service';

@Module({
  controllers: [StockAlertsController],
  providers: [StockAlertsService],
  // The AI assistant reads through it, with the same permissions (ADR-042).
  exports: [StockAlertsService],
})
export class StockAlertsModule {}
