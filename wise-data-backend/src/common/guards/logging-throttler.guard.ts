import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * The global rate limiter, plus a log line for every blocked request. The
 * logged address is the one the limiter keys on: comparing it with the real
 * client IP shows whether TRUST_PROXY_HOPS matches the proxies in front.
 */
@Injectable()
export class LoggingThrottlerGuard extends ThrottlerGuard {
  private readonly rateLimitLogger = new Logger('RateLimit');

  protected override async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    // JSON.stringify keeps client-supplied header values on one log line.
    this.rateLimitLogger.warn(
      `Rate limit hit: ${request.method} ${request.path} from ${request.ip} (x-forwarded-for ${JSON.stringify(request.headers['x-forwarded-for'] ?? null)})`,
    );
    return super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
