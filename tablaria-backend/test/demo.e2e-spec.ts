import { INestApplication } from '@nestjs/common';
import type {
  AuthUser,
  OrganizationDetail,
  OrganizationSummary,
  Paginated,
  TableRecord,
  TableSummary,
} from '@tablaria/shared';
import { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import { DEMO_ORGANIZATION, DEMO_TABLES } from '../src/demo/demo-data';
import {
  DEMO_TTL_MS,
  MAX_ACTIVE_DEMO_ACCOUNTS,
} from '../src/demo/demo.service';
import {
  createClient,
  createTestApp,
  resetDatabase,
  setCookies,
  type TestClient,
} from './helpers/app';
import { listEmails } from './helpers/mailpit';

describe('Demo accounts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function startDemo(client: TestClient = createClient(app)) {
    const response = await client.post('/api/auth/demo').expect(201);
    return { client, user: response.body as AuthUser, response };
  }

  it('signs the visitor into a temporary account with example tables', async () => {
    const before = Date.now();
    const { client, user, response } = await startDemo();

    expect(user.email).toMatch(/^demo-.+@demo\.invalid$/);
    expect(user.emailVerifiedAt).not.toBeNull();
    const expiresIn = new Date(user.demoExpiresAt ?? 0).getTime() - before;
    expect(expiresIn).toBeGreaterThan(DEMO_TTL_MS - 60_000);
    expect(expiresIn).toBeLessThanOrEqual(DEMO_TTL_MS + 60_000);
    expect(Object.keys(setCookies(response))).toEqual(
      expect.arrayContaining(['tb_access', 'tb_refresh']),
    );

    const me = await client.get('/api/auth/me').expect(200);
    expect(me.body).toEqual(user);

    const tables = (await client.get('/api/tables').expect(200))
      .body as TableSummary[];
    const summary = (list: { name: string; rows: unknown[] }[]) =>
      list.map(({ name, rows }) => [name, rows.length]).sort();
    expect(
      tables.map(({ name, recordCount }) => [name, recordCount]).sort(),
    ).toEqual(summary(DEMO_TABLES.filter((table) => !table.inOrganization)));

    // And an example organization with fictitious colleagues.
    const spaces = (await client.get('/api/organizations').expect(200))
      .body as OrganizationSummary[];
    const organization = spaces.find(({ personal }) => !personal);
    expect(organization).toMatchObject({
      name: DEMO_ORGANIZATION.name,
      role: 'OWNER',
      memberCount: DEMO_ORGANIZATION.members.length + 1,
    });
    const organizationTables = (
      await client
        .get(`/api/organizations/${organization?.id}/tables`)
        .expect(200)
    ).body as TableSummary[];
    expect(
      organizationTables.map(({ name, recordCount }) => [name, recordCount]),
    ).toEqual(summary(DEMO_TABLES.filter((table) => table.inOrganization)));

    const catalog = tables.find(({ name }) => name === DEMO_TABLES[0].name);
    const records = (
      await client.get(`/api/tables/${catalog?.id}/records`).expect(200)
    ).body as Paginated<TableRecord>;
    expect(records.meta.total).toBe(DEMO_TABLES[0].rows.length);
  });

  it('gives every visitor an account of their own', async () => {
    const first = await startDemo();
    const second = await startDemo();

    expect(second.user.id).not.toBe(first.user.id);
    const firstTables = (await first.client.get('/api/tables').expect(200))
      .body as TableSummary[];
    await second.client.get(`/api/tables/${firstTables[0].id}`).expect(404);
  });

  it('stops refreshing an expired demo session', async () => {
    const { client, user } = await startDemo();
    await prisma.user.update({
      where: { id: user.id },
      data: { demoExpiresAt: new Date(Date.now() - 1000) },
    });

    await client.post('/api/auth/refresh').expect(401);
  });

  it('deletes expired demo accounts with all their data', async () => {
    const { client, user } = await startDemo();
    const organization = (
      await client
        .post('/api/organizations')
        .send({ name: 'De la demo' })
        .expect(201)
    ).body as OrganizationDetail;
    // Past expiry plus one access-token lifetime, so no token can still be valid.
    const tableIds = (
      await prisma.inventoryTable.findMany({
        where: { createdById: user.id },
        select: { id: true },
      })
    ).map(({ id }) => id);
    expect(tableIds.length).toBeGreaterThan(0);
    // The example organization's fictitious members expire with the visitor.
    await prisma.user.updateMany({
      where: { demoExpiresAt: new Date(user.demoExpiresAt ?? 0) },
      data: { demoExpiresAt: new Date(Date.now() - 16 * 60 * 1000) },
    });

    await startDemo();

    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    // Its spaces go with it: the personal one, the example organization and
    // the one it created, with all their tables.
    expect(
      await prisma.inventoryTable.count({ where: { id: { in: tableIds } } }),
    ).toBe(0);
    expect(
      await prisma.organization.findUnique({ where: { id: organization.id } }),
    ).toBeNull();
  });

  it('never emails demo addresses', async () => {
    const { user } = await startDemo();

    await createClient(app)
      .post('/api/auth/forgot-password')
      .send({ email: user.email })
      .expect(202);
    await createClient(app)
      .post('/api/auth/register')
      .send({ email: user.email, password: 'correct horse battery' })
      .expect(202);

    expect(await listEmails(user.email)).toHaveLength(0);
  });

  it('refuses new demo accounts when too many are active', async () => {
    const expiresAt = new Date(Date.now() + DEMO_TTL_MS);
    await prisma.user.createMany({
      data: Array.from({ length: MAX_ACTIVE_DEMO_ACCOUNTS }, (_, index) => ({
        email: `demo-${index}@demo.invalid`,
        passwordHash: 'unused',
        emailVerifiedAt: new Date(),
        demoExpiresAt: expiresAt,
      })),
    });

    await createClient(app).post('/api/auth/demo').expect(503);
  });

  it('limits how often one client can start a demo', async () => {
    const client = createClient(app);
    for (let attempt = 0; attempt < 3; attempt++) {
      await client.post('/api/auth/demo').expect(201);
    }
    await client.post('/api/auth/demo').expect(429);
  });
});
