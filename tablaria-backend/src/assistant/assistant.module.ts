import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { MetricsModule } from '../metrics/metrics.module';
import { RecordsModule } from '../records/records.module';
import { StockAlertsModule } from '../stock-alerts/stock-alerts.module';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { ChatModel } from './chat-model';

@Module({
  imports: [
    RecordsModule,
    MetricsModule,
    StockAlertsModule,
    StockMovementsModule,
  ],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    {
      provide: ChatModel,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new ChatModel({
          apiKey: config.get('AI_API_KEY', { infer: true }),
          baseUrl: config.get('AI_BASE_URL', { infer: true }),
          model: config.get('AI_MODEL', { infer: true }),
        }),
    },
  ],
})
export class AssistantModule {}
