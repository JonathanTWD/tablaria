import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import type { Env } from './config/env.schema';

export const API_PREFIX = 'api';

/** HTTP-level configuration shared by main.ts and e2e tests. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.use(helmet());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
}
