import { Controller, Get, Query } from '@nestjs/common';
import {
  type UpcomingDates,
  type UpcomingDatesQuery,
  upcomingDatesQuerySchema,
} from '@tablaria/shared';
import { CurrentUserId } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UpcomingDatesService } from './upcoming-dates.service';

@Controller('upcoming-dates')
export class UpcomingDatesController {
  constructor(private readonly upcoming: UpcomingDatesService) {}

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Query(new ZodValidationPipe(upcomingDatesQuerySchema))
    query: UpcomingDatesQuery,
  ): Promise<UpcomingDates> {
    return this.upcoming.list(userId, query);
  }
}
