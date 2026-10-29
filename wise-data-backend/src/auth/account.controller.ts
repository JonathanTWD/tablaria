import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  type AccountExport,
  type ChangePasswordInput,
  changePasswordSchema,
  type DeleteAccountInput,
  deleteAccountSchema,
  type MessageResponse,
} from '@wisedata/shared';
import type { Response } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { Env } from '../config/env.schema';
import { AccountService } from './account.service';
import { clearSessionCookies, setSessionCookies } from './auth-cookies';
import { SENSITIVE_THROTTLE } from './auth.constants';
import { CurrentUserId } from './decorators';

/** A whole account's data in one response: rare, and costly to build. */
const EXPORT_THROTTLE = { default: { limit: 3, ttl: 60_000 } };

@Controller('account')
export class AccountController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly account: AccountService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookies =
      config.get('COOKIE_SECURE', { infer: true }) ??
      config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Throttle(SENSITIVE_THROTTLE)
  @Post('password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(changePasswordSchema))
    body: ChangePasswordInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageResponse> {
    const tokens = await this.account.changePassword(userId, body);
    setSessionCookies(response, tokens, this.secureCookies);
    return { message: 'Password updated' };
  }

  @Post('logout-everywhere')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutEverywhere(
    @CurrentUserId() userId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.account.logoutEverywhere(userId);
    clearSessionCookies(response, this.secureCookies);
  }

  @Throttle(EXPORT_THROTTLE)
  @Get('export')
  async export(
    @CurrentUserId() userId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccountExport> {
    const data = await this.account.export(userId);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="wisedata-${data.exportedAt.slice(0, 10)}.json"`,
    );
    return data;
  }

  // POST rather than DELETE: the password travels in the body.
  @Throttle(SENSITIVE_THROTTLE)
  @Post('delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: DeleteAccountInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.account.delete(userId, body.password);
    clearSessionCookies(response, this.secureCookies);
  }
}
