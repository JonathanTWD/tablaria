import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type AssistantChat,
  assistantChatSchema,
  type AssistantReply,
  type AssistantStatus,
} from '@tablaria/shared';
import { CurrentUserId } from '../auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AssistantService } from './assistant.service';

/** Each question can call the model several times; the daily limit is the main cap. */
const CHAT_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get()
  status(@CurrentUserId() userId: string): Promise<AssistantStatus> {
    return this.assistant.status(userId);
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @Throttle(CHAT_THROTTLE)
  chat(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(assistantChatSchema)) body: AssistantChat,
  ): Promise<AssistantReply> {
    return this.assistant.chat(userId, body);
  }
}
