import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PasswordService } from '../../src/auth/password.service';
import { PrismaService } from '../../src/database/prisma.service';

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  // A listening server lets cookie-keeping agents reuse it across requests.
  await app.listen(0, '127.0.0.1');
  return app;
}

/** Removes every row; users cascade to tokens, tables, columns and records. */
export async function resetDatabase(app: INestApplication): Promise<void> {
  await app.get(PrismaService).$executeRaw`TRUNCATE TABLE "users" CASCADE`;
}

export function uniqueEmail(): string {
  return `user-${randomUUID()}@example.com`;
}

function randomIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

/**
 * Cookie-keeping client with its own client IP (via X-Forwarded-For with
 * TRUST_PROXY_HOPS=1), so per-IP rate limits never leak between tests.
 */
export function createClient(app: INestApplication<App>, ip = randomIp()) {
  const agent = request.agent(app.getHttpServer());
  agent.set('X-Forwarded-For', ip);
  return agent;
}

export type TestClient = ReturnType<typeof createClient>;

/** Cookies set by a response, keyed by name, with their raw attribute strings. */
export function setCookies(response: request.Response): Record<string, string> {
  const header = response.headers['set-cookie'] as unknown;
  const list = Array.isArray(header) ? (header as string[]) : [];
  return Object.fromEntries(
    list.map((cookie) => [cookie.slice(0, cookie.indexOf('=')), cookie]),
  );
}

/** Value of a cookie from its raw Set-Cookie string. */
export function cookieValue(rawCookie: string): string {
  return rawCookie.slice(rawCookie.indexOf('=') + 1, rawCookie.indexOf(';'));
}

const SIGNED_IN_PASSWORD = 'correct horse battery';

/**
 * Client logged in as a fresh, already verified user. Skips the email flow,
 * which auth.e2e-spec covers, to keep resource tests fast.
 */
export async function createSignedInClient(
  app: INestApplication<App>,
): Promise<TestClient> {
  const email = uniqueEmail();
  await app.get(PrismaService).user.create({
    data: {
      email,
      passwordHash: await app.get(PasswordService).hash(SIGNED_IN_PASSWORD),
      emailVerifiedAt: new Date(),
    },
  });
  const client = createClient(app);
  await client
    .post('/api/auth/login')
    .send({ email, password: SIGNED_IN_PASSWORD })
    .expect(200);
  return client;
}
