import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ColumnsModule } from './columns/columns.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingThrottlerGuard } from './common/guards/logging-throttler.guard';
import { validateEnv } from './config/env.schema';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { RecordsModule } from './records/records.module';
import { StockAlertsModule } from './stock-alerts/stock-alerts.module';
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
    StockAlertsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: LoggingThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
