import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { RealtimeTicket } from '@wisedata/shared';
import { CurrentUserId } from '../auth/decorators';
import { RealtimeService } from './realtime.service';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * The WebSocket may live on another domain than the app, where the session
   * cookie never goes, so the browser trades its session for a ticket here.
   */
  @Post('ticket')
  @HttpCode(HttpStatus.OK)
  ticket(@CurrentUserId() userId: string): RealtimeTicket {
    return {
      ticket: this.realtime.issueTicket(userId),
      url: this.realtime.url,
    };
  }
}
