import { INestApplication } from '@nestjs/common';
import {
  STOCK_ALERTS_LIMIT,
  type StockAlerts,
  type TableDetail,
} from '@tablaria/shared';
import { App } from 'supertest/types';
import {
  createClient,
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

describe('Stock alerts (e2e)', () => {
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

  /** A basic inventory: its "Cantidad" column warns below 5. */
  async function createInventory(client: TestClient, name = 'Almacén') {
    const response = await client
      .post('/api/tables')
      .send({ name, templateId: 'basic-inventory' })
      .expect(201);
    const table = response.body as TableDetail;
    const id = (columnName: string) =>
      table.columns.find(({ name }) => name === columnName)?.id ?? '';
    const add = (product: string, quantity?: number) =>
      client
        .post(`/api/tables/${table.id}/records`)
        .send({
          data: {
            [id('Producto')]: product,
            ...(quantity !== undefined && { [id('Cantidad')]: quantity }),
          },
        })
        .expect(201);
    return { table, id, add };
  }

  async function alerts(client: TestClient): Promise<StockAlerts> {
    return (await client.get('/api/stock-alerts').expect(200))
      .body as StockAlerts;
  }

  it('lists records below the threshold, the most urgent first', async () => {
    const client = await createSignedInClient(app);
    const { table, add } = await createInventory(client);
    await add('Guantes', 4);
    await add('Etiquetas', 0);
    await add('Cajas', 320);
    await add('Bridas', 5);

    expect(table.columns.find(({ name }) => name === 'Cantidad')).toMatchObject(
      { options: { alertBelow: 5 } },
    );
    expect(await alerts(client)).toEqual({
      total: 2,
      items: [
        {
          tableId: table.id,
          tableName: 'Almacén',
          recordId: expect.any(String) as string,
          label: 'Etiquetas',
          columnName: 'Cantidad',
          value: 0,
          alertBelow: 5,
        },
        expect.objectContaining({ label: 'Guantes', value: 4 }) as unknown,
      ],
    });
  });

  it('follows threshold changes and ignores columns without one', async () => {
    const client = await createSignedInClient(app);
    const { table, id, add } = await createInventory(client);
    await add('Cajas', 8);
    const quantity = `/api/tables/${table.id}/columns/${id('Cantidad')}`;

    await client
      .patch(quantity)
      .send({ options: { alertBelow: 10 } })
      .expect(200);
    expect((await alerts(client)).total).toBe(1);

    await client.patch(quantity).send({ options: null }).expect(200);
    expect((await alerts(client)).total).toBe(0);

    await client
      .patch(quantity)
      .send({ options: { alertBelow: -1 } })
      .expect(400);
  });

  it('caps the list but counts every alert across tables', async () => {
    const client = await createSignedInClient(app);
    const first = await createInventory(client, 'Almacén A');
    const second = await createInventory(client, 'Almacén B');
    for (let index = 0; index < STOCK_ALERTS_LIMIT; index++) {
      await first.add(`A${index}`, 1);
      await second.add(`B${index}`, 2);
    }

    const result = await alerts(client);
    expect(result.total).toBe(STOCK_ALERTS_LIMIT * 2);
    expect(result.items).toHaveLength(STOCK_ALERTS_LIMIT);
    expect(result.items.every(({ value }) => value === 1)).toBe(true);
  });

  it("never shows another user's alerts", async () => {
    const owner = await createSignedInClient(app);
    const { add } = await createInventory(owner);
    await add('Guantes', 1);

    const other = await createSignedInClient(app);
    expect(await alerts(other)).toEqual({ total: 0, items: [] });
    await createClient(app).get('/api/stock-alerts').expect(401);
  });

  it('greets demo visitors with a few alerts to look at', async () => {
    const client = createClient(app);
    await client.post('/api/auth/demo').expect(201);

    expect((await alerts(client)).total).toBeGreaterThan(0);
  });
});
