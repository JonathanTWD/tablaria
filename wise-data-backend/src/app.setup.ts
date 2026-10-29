import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
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
  // An import carries a whole file's rows; every other route keeps the 100 KB default.
  app.use(
    `/${API_PREFIX}/tables/:tableId/import`,
    json({ limit: IMPORT_BODY_LIMIT }),
  );
  app.use(json());
  app.use(urlencoded({ extended: true }));
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  app.get(RealtimeService).attach(app.getHttpServer() as Server);
}
