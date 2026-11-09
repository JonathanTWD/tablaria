import { INestApplication } from '@nestjs/common';
import {
  type AuthUser,
  type OrganizationDetail,
  type OrganizationSummary,
  type Paginated,
  type RecordPage,
  type StockAlerts,
  type StockHistory,
  type TableDetail,
  type TableSummary,
  UPCOMING_DATES_LIMIT,
  type UpcomingDates,
} from '@tablaria/shared';
import { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import { DEMO_ORGANIZATION, demoTables } from '../src/demo/demo-data';
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

const DEMO_TABLES = demoTables(new Date());

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

    // The shop's catalog comes first: what a visitor opens.
    expect(tables[0].name).toBe('Productos');
  });

  it('shows every kind of column, worked out from linked tables', async () => {
    const { client } = await startDemo();
    const tables = (await client.get('/api/tables').expect(200))
      .body as TableSummary[];
    const open = async (name: string) => {
      const id = tables.find((table) => table.name === name)?.id;
      const detail = (await client.get(`/api/tables/${id}`).expect(200))
        .body as TableDetail;
      const page = (
        await client
          .get(`/api/tables/${id}/records`)
          .query({ pageSize: 100 })
          .expect(200)
      ).body as RecordPage;
      const column = (columnName: string) =>
        detail.columns.find(({ name }) => name === columnName)?.id ?? '';
      const row = (first: string) =>
        page.data.find(({ data }) => data[detail.columns[0].id] === first)
          ?.data ?? {};
      return { id, detail, page, column, row };
    };

    const products = await open('Productos');
    expect(products.detail.columns.map(({ type }) => type)).toEqual(
      expect.arrayContaining(['relation', 'lookup', 'formula', 'rollup']),
    );
    const drill = products.row('Taladro percutor 750 W');
    // Margin and stock value are formulas; the supplier's phone, a lookup.
    expect(drill[products.column('Margen')]).toBe(37.5);
    expect(drill[products.column('Valor del stock')]).toBeCloseTo(52.4 * 14);
    expect(drill[products.column('Teléfono del proveedor')]).toBe(
      '961 555 210',
    );
    // In three orders, through a relation to several products.
    expect(drill[products.column('Pedidos')]).toBe(3);

    const suppliers = await open('Proveedores');
    expect(suppliers.row('Ferrotool')).toMatchObject({
      [suppliers.column('Productos')]: 3,
      [suppliers.column('Unidades en stock')]: 23,
    });

    const orders = await open('Pedidos');
    const big = orders.row('PED-1038')[orders.column('Productos')];
    expect(Array.isArray(big) && big.length).toBe(3);
    // Deliveries still to come fill the calendar of the coming weeks.
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = orders.page.data.filter(
      ({ data }) => String(data[orders.column('Entrega')] ?? '') > today,
    );
    expect(upcoming.length).toBeGreaterThanOrEqual(5);
    // Deliveries within a week and warranties ending soon fill "Próximamente".
    const due = (
      await client.get('/api/upcoming-dates').query({ today }).expect(200)
    ).body as UpcomingDates;
    expect(due.total).toBeGreaterThanOrEqual(UPCOMING_DATES_LIMIT);
    expect(new Set(due.items.map(({ columnName }) => columnName))).toEqual(
      new Set(['Entrega', 'Fin de garantía']),
    );

    // Some products run low, and the drill has a stock history that adds up.
    const alerts = (
      await client
        .get('/api/stock-alerts')
        .query({ tableId: products.id })
        .expect(200)
    ).body as StockAlerts;
    expect(alerts.total).toBeGreaterThan(0);
    const drillId = products.page.data.find(
      ({ data }) =>
        data[products.detail.columns[0].id] === 'Taladro percutor 750 W',
    )?.id;
    const history = (
      await client
        .get(`/api/tables/${products.id}/records/${drillId}/movements`)
        .query({ columnId: products.column('Stock') })
        .expect(200)
    ).body as StockHistory;
    // Newest first: the last movement leaves the stock the table shows.
    expect(history.data[0].balance).toBe(14);
    expect(history.data.map(({ kind }) => kind)).toEqual([
      'out',
      'out',
      'in',
      'count',
    ]);

    // Every table has a history, and the orders spread over months.
    const activity = (
      await client.get(`/api/tables/${products.id}/activity`).expect(200)
    ).body as Paginated<unknown>;
    expect(activity.meta.total).toBeGreaterThan(products.page.meta.total);
    const timeline = (
      await client
        .get(`/api/tables/${orders.id}/metrics/timeline`)
        .query({ date: orders.column('Fecha') })
        .expect(200)
    ).body as { buckets: unknown[] };
    expect(timeline.buckets.length).toBeGreaterThanOrEqual(5);
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
