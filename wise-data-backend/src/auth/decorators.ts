import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route out of the global JwtAuthGuard. Routes are protected by default. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export interface AuthenticatedRequest extends Request {
  userId: string;
}

/** Id of the user authenticated by JwtAuthGuard. */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().userId,
);
