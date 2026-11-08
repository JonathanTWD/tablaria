import { Module } from '@nestjs/common';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from './stock-movements.service';

@Module({
  controllers: [StockMovementsController],
  providers: [StockMovementsService],
  // The AI assistant reads through it, with the same permissions (ADR-042).
  exports: [StockMovementsService],
})
export class StockMovementsModule {}
