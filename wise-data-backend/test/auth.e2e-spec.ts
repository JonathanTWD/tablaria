import { INestApplication } from '@nestjs/common';
import type { ApiErrorBody, AuthUser } from '@wisedata/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  cookieValue,
  createClient,
  createTestApp,
  resetDatabase,
  setCookies,
  type TestClient,
  uniqueEmail,
} from './helpers/app';
import { REFRESH_REUSE_GRACE_MS } from '../src/auth/auth.constants';
import { EMAIL_TOKEN_LIMIT } from '../src/auth/email-token.service';
import { hashToken } from '../src/auth/secure-token';
import { PrismaService } from '../src/database/prisma.service';
import { extractToken, latestEmail, listEmails } from './helpers/mailpit';

const PASSWORD = 'correct horse battery';
const GENERIC_MESSAGE = 'If the address is valid, an email is on its way';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerAndVerify(client: TestClient, email: string) {
    await client
      .post('/api/auth/register')
      .send({ email, password: PASSWORD })
      .expect(202);
    const token = extractToken(await latestEmail(email));
    await client
      .post('/api/auth/verify-email')
      .send({ token, password: PASSWORD })
      .expect(200);
  }

  function login(client: TestClient, email: string, password = PASSWORD) {
    return client.post('/api/auth/login').send({ email, password });
  }

  describe('registration and verification', () => {
    it('registers, verifies the email and logs in', async () => {
      const client = createClient(app);
      const email = uniqueEmail();

      const registered = await client
        .post('/api/auth/register')
        .send({ email: `  ${email.toUpperCase()} `, password: PASSWORD })
        .expect(202);
      expect(registered.body).toEqual({ message: GENERIC_MESSAGE });

      const verificationEmail = await latestEmail(email);
      expect(verificationEmail.Subject).toBe('Confirma tu email en WiseData');
      // Verifying confirms the password and starts the session directly.
      const verified = await client
        .post('/api/auth/verify-email')
        .send({ token: extractToken(verificationEmail), password: PASSWORD })
        .expect(200);
      const user = verified.body as AuthUser;
      expect(user).toEqual({
        id: expect.any(String) as string,
        email,
        emailVerifiedAt: expect.any(String) as string,
        createdAt: expect.any(String) as string,
      });

      const me = await client.get('/api/auth/me').expect(200);
      expect(me.body).toEqual(user);

      await login(createClient(app), email).expect(200);
    });

    it('rejects login until the email is verified', async () => {
      const client = createClient(app);
      const email = uniqueEmail();
      await client
        .post('/api/auth/register')
        .send({ email, password: PASSWORD })
        .expect(202);

      const response = await login(client, email).expect(403);
      expect((response.body as ApiErrorBody).message).toBe(
        'Email not verified',
      );
      expect(setCookies(response)).toEqual({});
    });

    it('does not reveal existing accounts and notifies their owner', async () => {
      const client = createClient(app);
      const email = uniqueEmail();
      await registerAndVerify(client, email);

      const again = await client
        .post('/api/auth/register')
        .send({ email, password: 'another password' })
        .expect(202);
      expect(again.body).toEqual({ message: GENERIC_MESSAGE });
      expect((await latestEmail(email)).Subject).toBe(
        'Ya tienes una cuenta en WiseData',
      );

      // The original password still works.
      await login(client, email).expect(200);
    });

    it('prevents pre-hijacking when the attacker registers first', async () => {
      const email = uniqueEmail();
      const attacker = createClient(app);
      await attacker
        .post('/api/auth/register')
        .send({ email, password: 'attacker password' })
        .expect(202);

      const victim = createClient(app);
      await victim
        .post('/api/auth/register')
        .send({ email, password: PASSWORD })
        .expect(202);
      const token = extractToken(await latestEmail(email));
      await victim
        .post('/api/auth/verify-email')
        .send({ token, password: PASSWORD })
        .expect(200);

      await login(attacker, email, 'attacker password').expect(401);
      await login(victim, email).expect(200);
    });

    it('prevents pre-hijacking when the attacker registers after the victim', async () => {
      const email = uniqueEmail();
      const victim = createClient(app);
      await victim
        .post('/api/auth/register')
        .send({ email, password: PASSWORD })
        .expect(202);

      const attacker = createClient(app);
      await attacker
        .post('/api/auth/register')
        .send({ email, password: 'attacker password' })
        .expect(202);

      // The victim follows the newest link (the attacker's registration triggered it).
      const token = extractToken(await latestEmail(email));
      await victim
        .post('/api/auth/verify-email')
        .send({ token, password: PASSWORD })
        .expect(200);

      await login(attacker, email, 'attacker password').expect(401);
      await login(victim, email).expect(200);
    });

    it('rejects reused, unknown and malformed verification tokens', async () => {
      const client = createClient(app);
      const email = uniqueEmail();
      await client
        .post('/api/auth/register')
        .send({ email, password: PASSWORD })
        .expect(202);
      const token = extractToken(await latestEmail(email));

      await client
        .post('/api/auth/verify-email')
        .send({ token, password: PASSWORD })
        .expect(200);
      await client
        .post('/api/auth/verify-email')
        .send({ token, password: PASSWORD })
        .expect(400);
      await client
        .post('/api/auth/verify-email')
        .send({ token: 'not-a-real-token', password: PASSWORD })
        .expect(400);
      await client.post('/api/auth/verify-email').send({}).expect(400);
    });

    it('resending verification invalidates the previous link', async () => {
      const client = createClient(app);
      const email = uniqueEmail();
      await client
        .post('/api/auth/register')
        .send({ email, password: PASSWORD })
        .expect(202);
      const firstToken = extractToken(await latestEmail(email));

      await client
        .post('/api/auth/resend-verification')
        .send({ email })
        .expect(202);
      const emails = await listEmails(email);
      expect(emails).toHaveLength(2);
      const secondToken = extractToken(await latestEmail(email));

      await client
        .post('/api/auth/verify-email')
        .send({ token: firstToken, password: PASSWORD })
        .expect(400);
      await client
        .post('/api/auth/verify-email')
        .send({ token: secondToken, password: PASSWORD })
        .expect(200);
    });

    it('validates input with per-field details', async () => {
      const response = await createClient(app)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'short' })
        .expect(400);

      const body = response.body as ApiErrorBody;
      expect(body.details?.map((detail) => detail.path).sort()).toEqual([
        'email',
        'password',
      ]);
    });
  });

  describe('login', () => {
    it('gives the same answer for a wrong password and an unknown email', async () => {
      const client = createClient(app);
      const email = uniqueEmail();
      await registerAndVerify(client, email);

      const wrongPassword = await login(client, email, 'wrong password').expect(
        401,
      );
      const unknownEmail = await login(client, uniqueEmail()).expect(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });

    it('sets httpOnly, SameSite=Lax session cookies scoped to the API', async () => {
      const client = createClient(app);
      const email = uniqueEmail();
      await registerAndVerify(client, email);

      const cookies = setCookies(await login(client, email).expect(200));

      expect(cookies.wd_access).toMatch(/HttpOnly/);
      expect(cookies.wd_access).toMatch(/SameSite=Lax/);
      expect(cookies.wd_access).toMatch(/Path=\/api;/);
      expect(cookies.wd_refresh).toMatch(/HttpOnly/);
      expect(cookies.wd_refresh).toMatch(/Path=\/api\/auth;/);
    });

    it('never returns the password hash', async () => {
      const client = createClient(app);
      const email = uniqueEmail();
      await registerAndVerify(client, email);

      const response = await login(client, email).expect(200);
      expect(JSON.stringify(response.body)).not.toMatch(/password/i);
    });

    it('rate limits repeated attempts from the same client', async () => {
      const client = createClient(app, '10.255.0.1');
      for (let attempt = 0; attempt < 5; attempt++) {
        await login(client, uniqueEmail()).expect(401);
      }
      await login(client, uniqueEmail()).expect(429);

      // Another client is unaffected.
      await login(createClient(app), uniqueEmail()).expect(401);
    });
  });

  describe('protected routes', () => {
    it('rejects requests without a session using the standard error body', async () => {
      const response = await createClient(app).get('/api/auth/me').expect(401);
      expect(response.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Unauthorized',
      });
    });

    it('rejects a tampered access token', async () => {
      const client = createClient(app);
      const email = uniqueEmail();
      await registerAndVerify(client, email);
      const accessToken = cookieValue(
        setCookies(await login(client, email)).wd_access,
      );

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', `wd_access=${accessToken.slice(0, -2)}xx`)
        .expect(401);
    });
  });

  describe('sessions', () => {
    it('rotates the refresh token and revokes the family when an old one is reused', async () => {
      const client = createClient(app);
      const email = uniqueEmail();
      await registerAndVerify(client, email);
      const firstRefresh = cookieValue(
        setCookies(await login(client, email)).wd_refresh,
      );

      const rotated = await client.post('/api/auth/refresh').expect(200);
      const secondRefresh = cookieValue(setCookies(rotated).wd_refresh);
      expect(secondRefresh).not.toBe(firstRefresh);
      await client.get('/api/auth/me').expect(200);

      // Replays right after rotation look like a parallel tab: no tokens, session kept.
      const racing = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `wd_refresh=${firstRefresh}`)
        .expect(409);
      expect(setCookies(racing)).toEqual({});

      // Later, an attacker replays the first (already rotated) token.
      await app.get(PrismaService).refreshToken.updateMany({
        where: { tokenHash: hashToken(firstRefresh) },
        data: { revokedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS) },
      });
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `wd_refresh=${firstRefresh}`)
        .expect(401);

      // The legitimate, newer token is now revoked too.
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `wd_refresh=${secondRefresh}`)
        .expect(401);
    });

    it('logs out and clears the cookies', async () => {
      const client = createClient(app);
      const email = uniqueEmail();
      await registerAndVerify(client, email);
      await login(client, email).expect(200);

      const response = await client.post('/api/auth/logout').expect(204);
      expect(setCookies(response).wd_access).toMatch(
        /Expires=Thu, 01 Jan 1970/,
      );

      await client.get('/api/auth/me').expect(401);
      await client.post('/api/auth/refresh').expect(401);
    });

    it('keeps the session when two tabs refresh with the same token at once', async () => {
      const client = createClient(app);
      const email = uniqueEmail();
      await registerAndVerify(client, email);
      const refreshToken = cookieValue(
        setCookies(await login(client, email)).wd_refresh,
      );

      const [first, second] = await Promise.all(
        [0, 1].map(() =>
          request(app.getHttpServer())
            .post('/api/auth/refresh')
            .set('Cookie', `wd_refresh=${refreshToken}`),
        ),
      );
      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([200, 409]);

      const loser = first.status === 409 ? first : second;
      const winner = first.status === 200 ? first : second;
      // The losing response must not wipe the cookies the winner just set.
      expect(setCookies(loser)).toEqual({});

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set(
          'Cookie',
          `wd_refresh=${cookieValue(setCookies(winner).wd_refresh)}`,
        )
        .expect(200);
    });

    it('refresh without a cookie is rejected', async () => {
      await createClient(app).post('/api/auth/refresh').expect(401);
    });
  });

  describe('password reset', () => {
    it('resets the password, ends existing sessions and burns the token', async () => {
      const email = uniqueEmail();
      const oldSession = createClient(app);
      await registerAndVerify(oldSession, email);
      await login(oldSession, email).expect(200);

      const client = createClient(app);
      const requested = await client
        .post('/api/auth/forgot-password')
        .send({ email })
        .expect(202);
      expect(requested.body).toEqual({ message: GENERIC_MESSAGE });

      const resetEmail = await latestEmail(email);
      expect(resetEmail.Subject).toBe('Restablece tu contraseña de WiseData');
      const token = extractToken(resetEmail);
      const newPassword = 'a brand new password';

      await client
        .post('/api/auth/reset-password')
        .send({ token, password: newPassword })
        .expect(200);
      await client
        .post('/api/auth/reset-password')
        .send({ token, password: newPassword })
        .expect(400);

      await oldSession.post('/api/auth/refresh').expect(401);
      await login(client, email).expect(401);
      await login(client, email, newPassword).expect(200);
    });

    it('answers the same for unknown emails without sending anything', async () => {
      const email = uniqueEmail();
      const response = await createClient(app)
        .post('/api/auth/forgot-password')
        .send({ email })
        .expect(202);

      expect(response.body).toEqual({ message: GENERIC_MESSAGE });
      expect(await listEmails(email)).toHaveLength(0);
    });

    it('caps the emails an account receives, whatever the client IP', async () => {
      const email = uniqueEmail();
      await registerAndVerify(createClient(app), email);

      // A fresh IP per request, as someone rotating addresses would use.
      for (let attempt = 0; attempt < EMAIL_TOKEN_LIMIT.count + 2; attempt++) {
        const response = await createClient(app)
          .post('/api/auth/forgot-password')
          .send({ email })
          .expect(202);
        expect(response.body).toEqual({ message: GENERIC_MESSAGE });
      }

      await latestEmail(email);
      const resetEmails = (await listEmails(email)).filter(({ Subject }) =>
        Subject.startsWith('Restablece'),
      );
      expect(resetEmails).toHaveLength(EMAIL_TOKEN_LIMIT.count);
    });

    it('verifies the email of an unverified account that resets its password', async () => {
      const client = createClient(app);
      const email = uniqueEmail();
      await client
        .post('/api/auth/register')
        .send({ email, password: PASSWORD })
        .expect(202);

      await client
        .post('/api/auth/forgot-password')
        .send({ email })
        .expect(202);
      const token = extractToken(await latestEmail(email));
      await client
        .post('/api/auth/reset-password')
        .send({ token, password: PASSWORD })
        .expect(200);

      await login(client, email).expect(200);
    });
  });
});
