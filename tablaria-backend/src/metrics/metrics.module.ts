import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  // The AI assistant reads through it, with the same permissions (ADR-042).
  exports: [MetricsService],
})
export class MetricsModule {}
