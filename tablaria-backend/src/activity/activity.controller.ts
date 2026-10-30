import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  type ActivityPage,
  type ActivityQuery,
  activityQuerySchema,
} from '@tablaria/shared';
import { CurrentUserId } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ActivityService } from './activity.service';

@Controller('tables/:tableId/activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Query(new ZodValidationPipe(activityQuerySchema)) query: ActivityQuery,
  ): Promise<ActivityPage> {
    return this.activity.list(userId, tableId, query);
  }
}
