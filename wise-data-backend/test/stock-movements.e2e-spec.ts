import { INestApplication } from '@nestjs/common';
import type {
  AuthUser,
  StockHistory,
  StockMovement,
  TableColumn,
  TableDetail,
  TableRecord,
} from '@wisedata/shared';
import { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import {
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

describe('Stock movements (e2e)', () => {
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

  async function me(client: TestClient) {
    return (await client.get('/api/auth/me').expect(200)).body as AuthUser;
  }

  /** A product with 10 units in a stock column, and a price that isn't stock. */
  async function setup() {
    const owner = await createSignedInClient(app);
    const table = (
      await owner.post('/api/tables').send({ name: 'Almacén' }).expect(201)
    ).body as TableDetail;
    const base = `/api/tables/${table.id}`;
    const addColumn = async (body: object) =>
      (await owner.post(`${base}/columns`).send(body).expect(201))
        .body as TableColumn;
    const stock = await addColumn({
      name: 'Stock',
      type: 'number',
      stock: true,
    });
    const price = await addColumn({ name: 'Precio', type: 'number' });
    const record = (
      await owner
        .post(`${base}/records`)
        .send({ data: { [stock.id]: 10, [price.id]: 5 } })
        .expect(201)
    ).body as TableRecord;
    const movements = `${base}/records/${record.id}/movements`;
    return { owner, table, base, stock, price, record, movements };
  }

  async function history(client: TestClient, path: string) {
    return (await client.get(path).expect(200)).body as StockHistory;
  }

  it('adds goods in and out and recounts, refusing to go below zero', async () => {
    const { owner, stock, movements } = await setup();
    const name = (await me(owner)).email.split('@')[0];

    const goodsIn = (
      await owner
        .post(movements)
        .send({
          columnId: stock.id,
          kind: 'in',
          quantity: 5,
          note: ' Pedido 12 ',
        })
        .expect(201)
    ).body as { movement: StockMovement; record: TableRecord };
    expect(goodsIn.record.data[stock.id]).toBe(15);
    expect(goodsIn.movement).toMatchObject({
      kind: 'in',
      delta: 5,
      balance: 15,
      note: 'Pedido 12',
      by: name,
    });
    await owner
      .post(movements)
      .send({ columnId: stock.id, kind: 'out', quantity: 0.3 })
      .expect(201);
    await owner
      .post(movements)
      .send({ columnId: stock.id, kind: 'out', quantity: 20 })
      .expect(422);
    await owner
      .post(movements)
      .send({ columnId: stock.id, kind: 'in', quantity: 0 })
      .expect(400);
    const recount = (
      await owner
        .post(movements)
        .send({ columnId: stock.id, kind: 'count', quantity: 12 })
        .expect(201)
    ).body as { movement: StockMovement };
    // 14.7 counted as 12: float noise never shows.
    expect(recount.movement).toMatchObject({ delta: -2.7, balance: 12 });

    const { data, total } = await history(owner, movements);
    expect(total).toBe(4);
    expect(
      data.map(({ kind, delta, balance }) => [kind, delta, balance]),
    ).toEqual([
      ['count', -2.7, 12],
      ['out', -0.3, 14.7],
      ['in', 5, 15],
      // Creating the record with 10 units.
      ['edit', 10, 10],
    ]);
  });

  it('keeps edits and imports of a stock column, and nothing else', async () => {
    const { owner, base, stock, price, record, movements } = await setup();

    await owner
      .patch(`${base}/records/${record.id}`)
      .send({ data: { [price.id]: 7 } })
      .expect(200);
    await owner
      .patch(`${base}/records/${record.id}`)
      .send({ data: { [stock.id]: 7.7 } })
      .expect(200);
    // Updating by a unique key needs one: the price is made unique for the test.
    await owner
      .patch(`${base}/columns/${price.id}`)
      .send({ unique: true })
      .expect(200);
    await owner
      .post(`${base}/import`)
      .send({
        columns: [price.id, stock.id],
        rows: [
          ['7', '3'],
          ['9', '4'],
        ],
        updateBy: 0,
      })
      .expect(201);

    const { data } = await history(owner, movements);
    expect(
      data.map(({ kind, delta, balance }) => [kind, delta, balance]),
    ).toEqual([
      ['import', -4.7, 3],
      ['edit', -2.3, 7.7],
      ['edit', 10, 10],
    ]);
    const created = await app
      .get(PrismaService)
      .stockMovement.findMany({ where: { kind: 'IMPORT', delta: 4 } });
    expect(created).toHaveLength(1);
  });

  it('lets viewers read the history, only editors move stock', async () => {
    const { owner, table, stock, price, movements } = await setup();
    const viewer = await createSignedInClient(app);
    const stranger = await createSignedInClient(app);
    await app.get(PrismaService).tableShare.create({
      data: {
        tableId: table.id,
        userId: (await me(viewer)).id,
        role: 'VIEWER',
      },
    });

    expect((await history(viewer, movements)).total).toBe(1);
    await viewer
      .post(movements)
      .send({ columnId: stock.id, kind: 'in', quantity: 1 })
      .expect(403);
    await stranger.get(movements).expect(404);
    // Only stock columns take movements.
    await owner
      .post(movements)
      .send({ columnId: price.id, kind: 'in', quantity: 1 })
      .expect(400);
  });

  it('tracks stock only in number columns, and stops when the type changes', async () => {
    const { owner, base, stock } = await setup();
    await owner
      .post(`${base}/columns`)
      .send({ name: 'Notas', type: 'text', stock: true })
      .expect(400);

    const changed = (
      await owner
        .patch(`${base}/columns/${stock.id}`)
        .send({ type: 'text' })
        .expect(200)
    ).body as { column: TableColumn };
    expect(changed.column.stock).toBe(false);
  });
});
