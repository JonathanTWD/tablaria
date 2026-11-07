import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ActivityModule } from './activity/activity.module';
import { AssistantModule } from './assistant/assistant.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { ColumnsModule } from './columns/columns.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingThrottlerGuard } from './common/guards/logging-throttler.guard';
import { validateEnv } from './config/env.schema';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ImportsModule } from './imports/imports.module';
import { MailModule } from './mail/mail.module';
import { MetricsModule } from './metrics/metrics.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PublicLinksModule } from './public-links/public-links.module';
import { RecordsModule } from './records/records.module';
import { SavedViewsModule } from './saved-views/saved-views.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SharingModule } from './sharing/sharing.module';
import { StockAlertsModule } from './stock-alerts/stock-alerts.module';
import { StockMovementsModule } from './stock-movements/stock-movements.module';
import { TablesModule } from './tables/tables.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    MailModule,
    AuthModule,
    HealthModule,
    TablesModule,
    ColumnsModule,
    RecordsModule,
    SavedViewsModule,
    AttachmentsModule,
    AssistantModule,
    ImportsModule,
    StockAlertsModule,
    MetricsModule,
    StockMovementsModule,
    ActivityModule,
    PublicLinksModule,
    SharingModule,
    OrganizationsModule,
    RealtimeModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: LoggingThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
