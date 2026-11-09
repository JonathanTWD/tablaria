import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getStorageToken, type ThrottlerStorage } from '@nestjs/throttler';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ATTACHMENT_MAX_BYTES } from '@tablaria/shared';
import cookieParser from 'cookie-parser';
import {
  json,
  type NextFunction,
  raw,
  type Request,
  type RequestHandler,
  type Response,
  urlencoded,
} from 'express';
import helmet from 'helmet';
import { UPLOAD_LIMIT, UPLOAD_WINDOW_MS } from './attachments/upload-limit';
import { ACCESS_COOKIE } from './auth/auth.constants';
import { readCookie } from './auth/auth-cookies';
import { SessionService } from './auth/session.service';
import { API_PREFIX } from './common/api-prefix';
import type { Env } from './config/env.schema';
import { RealtimeService } from './realtime/realtime.service';

/** About 5,000 rows of a typical inventory; MAX_IMPORT_ROWS bounds the rest. */
const IMPORT_BODY_LIMIT = '2mb';

/** HTTP-level configuration (and the realtime WebSocket) shared by main.ts and e2e tests. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const proxyHops = config.get('TRUST_PROXY_HOPS', { infer: true });
  if (proxyHops > 0) {
    (app as NestExpressApplication).set('trust proxy', proxyHops);
  }

  app.use(helmet());
  app.use(cookieParser());
  // Compressed bodies are refused (415): the app never sends them, and
  // body-parser < 2.4.0 crashes on one with trailing bytes (GHSA advisory of
  // 2026-10-23). Keep it after upgrading: decompressing only adds risk.
  const parserOptions = { inflate: false };
  // An import carries a whole file's rows, and an upload a whole file; every
  // other route keeps the 100 KB default.
  const sessions = app.get(SessionService);
  // Middleware runs before the auth guard and the throttler, so only a valid
  // session gets the big limit; anyone else falls to the 100 KB one.
  const forSignedIn =
    (parser: RequestHandler) =>
    (request: Request, response: Response, next: NextFunction) => {
      sessions.verifyAccessToken(readCookie(request, ACCESS_COOKIE) ?? '').then(
        () => parser(request, response, next),
        () => next(),
      );
    };
  const importParser = forSignedIn(
    json({ ...parserOptions, limit: IMPORT_BODY_LIMIT }),
  );
  for (const path of [
    `/${API_PREFIX}/tables/:tableId/import`,
    `/${API_PREFIX}/organizations/:organizationId/tables/import`,
  ]) {
    app.use(path, importParser);
  }
  // An attachment is the raw body, whatever its declared type (ADR-039).
  const rawUpload = raw({
    ...parserOptions,
    type: () => true,
    limit: ATTACHMENT_MAX_BYTES,
  });
  const throttler = app.get<ThrottlerStorage>(getStorageToken());
  // The upload limit is checked here, before a byte of the file is read: past
  // it, the answer is a 429 and the connection closes instead of taking the file.
  const uploadParser = (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    sessions
      .verifyAccessToken(readCookie(request, ACCESS_COOKIE) ?? '')
      .then(
        async ({ sub }) => {
          const { isBlocked, timeToBlockExpire } = await throttler.increment(
            `upload:${sub}`,
            UPLOAD_WINDOW_MS,
            UPLOAD_LIMIT,
            UPLOAD_WINDOW_MS,
            'upload',
          );
          if (isBlocked) {
            response
              .status(429)
              .set({
                'Retry-After': String(timeToBlockExpire),
                Connection: 'close',
              })
              .json({ statusCode: 429, message: 'Too many uploads' });
            return;
          }
          rawUpload(request, response, next);
        },
        // No session: the 100 KB parser and the auth guard answer it.
        () => next(),
      )
      // A failing limiter store must not leave the request hanging.
      .catch(next);
  };
  app.use(
    `/${API_PREFIX}/tables/:tableId/records/:recordId/attachments`,
    (request: Request, response: Response, next: NextFunction) => {
      if (request.method === 'POST' && request.path === '/') {
        uploadParser(request, response, next);
      } else {
        next();
      }
    },
  );
  app.use(json(parserOptions));
  app.use(urlencoded({ ...parserOptions, extended: true }));
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  app.get(RealtimeService).attach(app.getHttpServer() as Server);
}
