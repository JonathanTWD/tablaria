import { INestApplication } from '@nestjs/common';
import {
  type TableColumn,
  type TableDetail,
  UPCOMING_DATES_LIMIT,
  type UpcomingDates,
} from '@tablaria/shared';
import { App } from 'supertest/types';
import {
  createClient,
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

const TODAY = '2026-11-09';

describe('Upcoming dates (e2e)', () => {
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

  /** Orders whose "Entrega" warns `alertDaysBefore` days ahead. */
  async function createOrders(
    client: TestClient,
    alertDaysBefore: number | null = 7,
    name = 'Pedidos',
  ) {
    const table = (await client.post('/api/tables').send({ name }).expect(201))
      .body as TableDetail;
    const columns = `/api/tables/${table.id}/columns`;
    const order = (
      await client
        .post(columns)
        .send({ name: 'Pedido', type: 'text', required: true })
        .expect(201)
    ).body as TableColumn;
    const delivery = (
      await client
        .post(columns)
        .send({
          name: 'Entrega',
          type: 'date',
          options: alertDaysBefore === null ? null : { alertDaysBefore },
        })
        .expect(201)
    ).body as TableColumn;
    const add = (code: string, date?: string) =>
      client
        .post(`/api/tables/${table.id}/records`)
        .send({
          data: { [order.id]: code, ...(date && { [delivery.id]: date }) },
        })
        .expect(201);
    return { table, order, delivery, add };
  }

  async function upcoming(
    client: TestClient,
    query: Record<string, string> = {},
  ): Promise<UpcomingDates> {
    return (
      await client
        .get('/api/upcoming-dates')
        .query({ today: TODAY, ...query })
        .expect(200)
    ).body as UpcomingDates;
  }

  it('lists dates from today to the warning, the nearest first', async () => {
    const client = await createSignedInClient(app);
    const { table, add } = await createOrders(client);
    await add('PED-1', '2026-11-16'); // in 7 days: the last one warned
    await add('PED-2', '2026-11-09'); // today
    await add('PED-3', '2026-11-17'); // in 8 days: too far
    await add('PED-4', '2026-11-08'); // yesterday: already passed
    await add('PED-5');

    expect(await upcoming(client)).toEqual({
      total: 2,
      items: [
        {
          tableId: table.id,
          tableName: 'Pedidos',
          recordId: expect.any(String) as string,
          label: 'PED-2',
          columnName: 'Entrega',
          date: '2026-11-09',
          daysLeft: 0,
        },
        expect.objectContaining({ label: 'PED-1', daysLeft: 7 }) as unknown,
      ],
    });
  });

  it('refuses year 0, which would break every date query', async () => {
    const client = await createSignedInClient(app);
    const { table, order, delivery } = await createOrders(client);
    const records = `/api/tables/${table.id}/records`;
    await client
      .post(records)
      .send({ data: { [order.id]: 'PED-1', [delivery.id]: '0000-01-01' } })
      .expect(400);
    await client
      .post(records)
      .send({ data: { [order.id]: 'PED-1', [delivery.id]: '0001-01-01' } })
      .expect(201);
  });

  it('follows warning changes and ignores columns without one', async () => {
    const client = await createSignedInClient(app);
    const { table, delivery, add } = await createOrders(client, null);
    await add('PED-1', '2026-11-20');
    expect((await upcoming(client)).total).toBe(0);

    const column = `/api/tables/${table.id}/columns/${delivery.id}`;
    await client
      .patch(column)
      .send({ options: { alertDaysBefore: 30 } })
      .expect(200);
    expect((await upcoming(client)).total).toBe(1);

    for (const options of [
      { alertDaysBefore: -1 },
      { alertDaysBefore: 1.5 },
      { alertDaysBefore: 366 },
    ]) {
      await client.patch(column).send({ options }).expect(400);
    }
  });

  it('caps the list but counts every date across tables', async () => {
    const client = await createSignedInClient(app);
    const first = await createOrders(client, 7, 'Pedidos A');
    const second = await createOrders(client, 7, 'Pedidos B');
    for (let index = 0; index < UPCOMING_DATES_LIMIT; index++) {
      await first.add(`A${index}`, '2026-11-10');
      await second.add(`B${index}`, '2026-11-12');
    }

    const result = await upcoming(client);
    expect(result.total).toBe(UPCOMING_DATES_LIMIT * 2);
    expect(result.items).toHaveLength(UPCOMING_DATES_LIMIT);
    expect(result.items.every(({ daysLeft }) => daysLeft === 1)).toBe(true);

    const own = await upcoming(client, { tableId: second.table.id });
    expect(own.total).toBe(UPCOMING_DATES_LIMIT);
    expect(own.items.every(({ label }) => label?.startsWith('B'))).toBe(true);
  });

  it('needs a valid today', async () => {
    const client = await createSignedInClient(app);
    await client.get('/api/upcoming-dates').expect(400);
    await client
      .get('/api/upcoming-dates')
      .query({ today: '9/11/2026' })
      .expect(400);
    // Year 0 is an ISO date, but not one PostgreSQL can cast.
    await client
      .get('/api/upcoming-dates')
      .query({ today: '0000-01-01' })
      .expect(400);
    await client
      .get('/api/upcoming-dates')
      .query({ today: TODAY, tableId: 'not-a-table' })
      .expect(400);
  });

  it("never shows another user's dates", async () => {
    const owner = await createSignedInClient(app);
    const { table, add } = await createOrders(owner);
    await add('PED-1', '2026-11-10');

    const other = await createSignedInClient(app);
    expect(await upcoming(other)).toEqual({ total: 0, items: [] });
    expect((await upcoming(other, { tableId: table.id })).total).toBe(0);
    await createClient(app)
      .get('/api/upcoming-dates')
      .query({ today: TODAY })
      .expect(401);
  });
});
