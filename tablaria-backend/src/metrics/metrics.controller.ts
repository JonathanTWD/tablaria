import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  type MetricGroups,
  type MetricGroupsQuery,
  metricGroupsQuerySchema,
  type MetricsSummary,
  type Timeline,
  type TimelineQuery,
  timelineQuerySchema,
} from '@tablaria/shared';
import { CurrentUserId } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MetricsService } from './metrics.service';

@Controller('tables/:tableId/metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('summary')
  summary(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ): Promise<MetricsSummary> {
    return this.metrics.summary(userId, tableId);
  }

  @Get('groups')
  groups(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Query(new ZodValidationPipe(metricGroupsQuerySchema))
    query: MetricGroupsQuery,
  ): Promise<MetricGroups> {
    return this.metrics.groups(userId, tableId, query);
  }

  @Get('timeline')
  timeline(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Query(new ZodValidationPipe(timelineQuerySchema)) query: TimelineQuery,
  ): Promise<Timeline> {
    return this.metrics.timeline(userId, tableId, query);
  }
}
