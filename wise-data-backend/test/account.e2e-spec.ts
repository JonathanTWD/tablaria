import { INestApplication } from '@nestjs/common';
import type {
  AccountExport,
  ApiErrorBody,
  AuthUser,
  OrganizationDetail,
  TableColumn,
  TableDetail,
} from '@wisedata/shared';
import { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import {
  createClient,
  createSignedInClient,
  createTestApp,
  resetDatabase,
  SIGNED_IN_PASSWORD,
  type TestClient,
} from './helpers/app';
import { extractToken, latestEmail } from './helpers/mailpit';

describe('Account (e2e)', () => {
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

  async function me(client: TestClient): Promise<AuthUser> {
    return (await client.get('/api/auth/me').expect(200)).body as AuthUser;
  }

  /** A second browser signed in as the same account. */
  async function secondSession(email: string, password = SIGNED_IN_PASSWORD) {
    const client = createClient(app);
    await client.post('/api/auth/login').send({ email, password }).expect(200);
    return client;
  }

  it('changes the password and ends every other session', async () => {
    const client = await createSignedInClient(app);
    const { email } = await me(client);
    const other = await secondSession(email);
    const newPassword = 'another long passphrase';

    await client
      .post('/api/account/password')
      .send({ currentPassword: 'wrong password', newPassword })
      .expect(422);
    await client
      .post('/api/account/password')
      .send({ currentPassword: SIGNED_IN_PASSWORD, newPassword: 'short' })
      .expect(400);
    await client
      .post('/api/account/password')
      .send({ currentPassword: SIGNED_IN_PASSWORD, newPassword })
      .expect(200);

    // This browser keeps a fresh session; the other one can't refresh any more.
    await client.post('/api/auth/refresh').expect(200);
    await other.post('/api/auth/refresh').expect(401);
    await createClient(app)
      .post('/api/auth/login')
      .send({ email, password: SIGNED_IN_PASSWORD })
      .expect(401);
    await secondSession(email, newPassword);
  });

  it('logs out everywhere', async () => {
    const client = await createSignedInClient(app);
    const { email } = await me(client);
    const other = await secondSession(email);

    await client.post('/api/account/logout-everywhere').expect(204);

    await client.post('/api/auth/refresh').expect(401);
    await other.post('/api/auth/refresh').expect(401);
  });

  it('exports the personal space with records keyed by column name', async () => {
    const client = await createSignedInClient(app);
    const { email } = await me(client);
    const table = (
      await client.post('/api/tables').send({ name: 'Almacén' }).expect(201)
    ).body as TableDetail;
    const product = (
      await client
        .post(`/api/tables/${table.id}/columns`)
        .send({ name: 'Producto', type: 'text' })
        .expect(201)
    ).body as TableColumn;
    await client
      .post(`/api/tables/${table.id}/records`)
      .send({ data: { [product.id]: 'Taladro' } })
      .expect(201);

    const response = await client.get('/api/account/export').expect(200);
    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="wisedata-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    const data = response.body as AccountExport;
    expect(data.account.email).toBe(email);
    expect(data.tables).toEqual([
      {
        name: 'Almacén',
        description: null,
        columns: [{ name: 'Producto', type: 'text', required: false }],
        records: [{ Producto: 'Taladro' }],
      },
    ]);
    // The password hash never leaves the API.
    expect(JSON.stringify(data)).not.toMatch(/argon2/);
  });

  it('deletes the account once others can own its organizations', async () => {
    const owner = await createSignedInClient(app);
    const ownerUser = await me(owner);
    const shared = (
      await owner
        .post('/api/organizations')
        .send({ name: 'Tienda' })
        .expect(201)
    ).body as OrganizationDetail;
    const solo = (
      await owner.post('/api/organizations').send({ name: 'Solo' }).expect(201)
    ).body as OrganizationDetail;
    const colleague = await createSignedInClient(app);
    const colleagueUser = await me(colleague);
    await owner
      .post(`/api/organizations/${shared.id}/invitations`)
      .send({ email: colleagueUser.email, role: 'ADMIN' })
      .expect(201);
    const token = extractToken(await latestEmail(colleagueUser.email));
    await colleague.post('/api/invitations/accept').send({ token }).expect(200);
    const personalTable = (
      await owner.post('/api/tables').send({ name: 'Mía' }).expect(201)
    ).body as TableDetail;

    await owner
      .post('/api/account/delete')
      .send({ password: 'wrong password' })
      .expect(422);
    // The only owner of an organization someone else uses must hand it over first.
    const refused = await owner
      .post('/api/account/delete')
      .send({ password: SIGNED_IN_PASSWORD })
      .expect(409);
    expect((refused.body as ApiErrorBody).details).toEqual([
      { path: shared.id, message: 'Tienda' },
    ]);

    await owner
      .patch(`/api/organizations/${shared.id}/members/${colleagueUser.id}`)
      .send({ role: 'OWNER' })
      .expect(200);
    await owner
      .post('/api/account/delete')
      .send({ password: SIGNED_IN_PASSWORD })
      .expect(204);

    const prisma = app.get(PrismaService);
    expect(
      await prisma.user.findUnique({ where: { id: ownerUser.id } }),
    ).toBeNull();
    expect(
      await prisma.inventoryTable.findUnique({
        where: { id: personalTable.id },
      }),
    ).toBeNull();
    // Where nobody else was, the organization goes too; where others are, it stays.
    expect(
      await prisma.organization.findUnique({ where: { id: solo.id } }),
    ).toBeNull();
    const kept = (
      await colleague.get(`/api/organizations/${shared.id}`).expect(200)
    ).body as OrganizationDetail;
    expect(kept.members).toEqual([
      expect.objectContaining({ userId: colleagueUser.id, role: 'OWNER' }),
    ]);
    await createClient(app)
      .post('/api/auth/login')
      .send({ email: ownerUser.email, password: SIGNED_IN_PASSWORD })
      .expect(401);
  });

  it('leaves demo accounts out: they have no password and expire on their own', async () => {
    const demo = createClient(app);
    await demo.post('/api/auth/demo').expect(201);

    await demo.get('/api/account/export').expect(403);
    await demo
      .post('/api/account/delete')
      .send({ password: 'anything' })
      .expect(403);
    await demo
      .post('/api/account/password')
      .send({ currentPassword: 'anything', newPassword: 'a long new password' })
      .expect(403);
  });
});
