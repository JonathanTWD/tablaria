import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthUser,
  type EmailOnlyInput,
  emailOnlySchema,
  type LoginInput,
  loginSchema,
  type MessageResponse,
  type RegisterInput,
  registerSchema,
  type ResetPasswordInput,
  resetPasswordSchema,
  type VerifyEmailInput,
  verifyEmailSchema,
} from '@wisedata/shared';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { Env } from '../config/env.schema';
import {
  clearSessionCookies,
  readCookie,
  setSessionCookies,
} from './auth-cookies';
import {
  DEMO_THROTTLE,
  REFRESH_COOKIE,
  REFRESH_THROTTLE,
  SENSITIVE_THROTTLE,
} from './auth.constants';
import { AuthService } from './auth.service';
import { CurrentUserId, Public } from './decorators';
import { RefreshSupersededException } from './session.service';

const CHECK_YOUR_EMAIL: MessageResponse = {
  message: 'If the address is valid, an email is on its way',
};

@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookies =
      config.get('COOKIE_SECURE', { infer: true }) ??
      config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Public()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<MessageResponse> {
    await this.auth.register(body);
    return CHECK_YOUR_EMAIL;
  }

  @Public()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUser> {
    const { user, tokens } = await this.auth.verifyEmail(body);
    setSessionCookies(response, tokens, this.secureCookies);
    return user;
  }

  @Public()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(
    @Body(new ZodValidationPipe(emailOnlySchema)) body: EmailOnlyInput,
  ): Promise<MessageResponse> {
    await this.auth.resendVerification(body.email);
    return CHECK_YOUR_EMAIL;
  }

  @Public()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUser> {
    const { user, tokens } = await this.auth.login(body);
    setSessionCookies(response, tokens, this.secureCookies);
    return user;
  }

  @Public()
  @Throttle(DEMO_THROTTLE)
  @Post('demo')
  @HttpCode(HttpStatus.CREATED)
  async demo(
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUser> {
    const { user, tokens } = await this.auth.startDemo();
    setSessionCookies(response, tokens, this.secureCookies);
    return user;
  }

  @Public()
  @Throttle(REFRESH_THROTTLE)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUser> {
    const refreshToken = readCookie(request, REFRESH_COOKIE);
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid session');
    }

    try {
      const { user, tokens } = await this.auth.refresh(refreshToken);
      setSessionCookies(response, tokens, this.secureCookies);
      return user;
    } catch (error) {
      // A concurrent refresh already stored new cookies in this browser; keep them.
      if (!(error instanceof RefreshSupersededException)) {
        clearSessionCookies(response, this.secureCookies);
      }
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = readCookie(request, REFRESH_COOKIE);
    if (refreshToken) {
      await this.auth.logout(refreshToken);
    }
    clearSessionCookies(response, this.secureCookies);
  }

  @Get('me')
  me(@CurrentUserId() userId: string): Promise<AuthUser> {
    return this.auth.me(userId);
  }

  @Public()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(
    @Body(new ZodValidationPipe(emailOnlySchema)) body: EmailOnlyInput,
  ): Promise<MessageResponse> {
    await this.auth.forgotPassword(body.email);
    return CHECK_YOUR_EMAIL;
  }

  @Public()
  @Throttle(SENSITIVE_THROTTLE)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageResponse> {
    await this.auth.resetPassword(body);
    clearSessionCookies(response, this.secureCookies);
    return { message: 'Password updated' };
  }
}
