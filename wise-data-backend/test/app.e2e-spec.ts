import { INestApplication } from '@nestjs/common';
import type { ApiErrorBody } from '@wisedata/shared';
import { gzipSync } from 'node:zlib';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './helpers/app';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health reports a reachable database', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('serves routes only under the /api prefix', () => {
    return request(app.getHttpServer()).get('/health').expect(404);
  });

  it('returns the standard error body for unknown routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/does-not-exist')
      .expect(404);

    const body = response.body as ApiErrorBody;
    expect(body.statusCode).toBe(404);
    expect(body.error).toBe('Not Found');
  });

  it('refuses compressed bodies, which the app never sends', async () => {
    const body = Buffer.concat([
      gzipSync(JSON.stringify({ email: 'ana@example.com' })),
      Buffer.from('trailing bytes'),
    ]);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send(body)
      .expect(415);
    // Still up: a bad compressed body used to crash body-parser < 2.4.0.
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });

  it('sets security headers', async () => {
    const response = await request(app.getHttpServer()).get('/api/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('allows configured origins with credentials and ignores others', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const blocked = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'https://evil.example.com');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});
