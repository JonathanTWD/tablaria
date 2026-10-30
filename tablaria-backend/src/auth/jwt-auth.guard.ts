import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCESS_COOKIE } from './auth.constants';
import { readCookie } from './auth-cookies';
import { type AuthenticatedRequest, IS_PUBLIC_KEY } from './decorators';
import { SessionService } from './session.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request, ACCESS_COOKIE);
    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const { sub } = await this.sessions.verifyAccessToken(token);
      request.userId = sub;
    } catch {
      // Expired or tampered token: the client should call /auth/refresh.
      throw new UnauthorizedException();
    }
    return true;
  }
}
