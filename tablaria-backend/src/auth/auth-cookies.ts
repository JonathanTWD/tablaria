import type { CookieOptions, Request, Response } from 'express';
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_PATH,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_MS,
} from './auth.constants';
import type { SessionTokens } from './session.service';

function baseOptions(secure: boolean): CookieOptions {
  // SameSite=Lax keeps cookies off cross-site POSTs, which covers CSRF for this JSON API.
  return { httpOnly: true, sameSite: 'lax', secure };
}

export function setSessionCookies(
  response: Response,
  tokens: SessionTokens,
  secure: boolean,
): void {
  response.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(secure),
    path: ACCESS_COOKIE_PATH,
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(secure),
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearSessionCookies(response: Response, secure: boolean): void {
  response.clearCookie(ACCESS_COOKIE, {
    ...baseOptions(secure),
    path: ACCESS_COOKIE_PATH,
  });
  response.clearCookie(REFRESH_COOKIE, {
    ...baseOptions(secure),
    path: REFRESH_COOKIE_PATH,
  });
}

export function readCookie(request: Request, name: string): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
