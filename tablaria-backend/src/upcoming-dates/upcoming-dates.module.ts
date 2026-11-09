import { Module } from '@nestjs/common';
import { UpcomingDatesController } from './upcoming-dates.controller';
import { UpcomingDatesService } from './upcoming-dates.service';

@Module({
  controllers: [UpcomingDatesController],
  providers: [UpcomingDatesService],
  // The assistant answers "what's due this week?" with it.
  exports: [UpcomingDatesService],
})
export class UpcomingDatesModule {}
