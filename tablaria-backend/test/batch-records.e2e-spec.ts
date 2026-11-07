import { INestApplication } from '@nestjs/common';
import type {
  ActivityPage,
  AuthUser,
  RecordBatchResult,
  RecordPage,
  TableColumn,
  TableDetail,
  TableRecord,
} from '@tablaria/shared';
import { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import {
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

describe('Batch edits (e2e)', () => {
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

  /** A table of three products, with a status, a stock and a unique SKU. */
  async function setup() {
    const owner = await createSignedInClient(app);
    const table = (
      await owner.post('/api/tables').send({ name: 'Productos' }).expect(201)
    ).body as TableDetail;
    const base = `/api/tables/${table.id}`;
    const addColumn = async (body: object) =>
      (await owner.post(`${base}/columns`).send(body).expect(201))
        .body as TableColumn;
    const name = await addColumn({ name: 'Producto', type: 'text' });
    const status = await addColumn({
      name: 'Estado',
      type: 'select',
      options: {
        choices: [
          { id: 'a', label: 'Disponible', color: 'green' },
          { id: 'b', label: 'Agotado', color: 'red' },
        ],
      },
    });
    const stock = await addColumn({
      name: 'Stock',
      type: 'number',
      stock: true,
    });
    const sku = await addColumn({ name: 'SKU', type: 'text', unique: true });
    const records: TableRecord[] = [];
    for (const [index, product] of [
      'Taladro',
      'Sierra',
      'Martillo',
    ].entries()) {
      records.push(
        (
          await owner
            .post(`${base}/records`)
            .send({
              data: {
                [name.id]: product,
                [status.id]: 'Disponible',
                [stock.id]: 5,
                [sku.id]: `SKU-${index}`,
              },
            })
            .expect(201)
        ).body as TableRecord,
      );
    }
    return { owner, table, base, name, status, stock, sku, records };
  }

  async function dataOf(client: TestClient, base: string) {
    const page = (
      await client.get(`${base}/records?pageSize=50&order=asc`).expect(200)
    ).body as RecordPage;
    return page.data.map(({ data }) => data);
  }

  it('changes one column in every selected record, and logs each change', async () => {
    const { owner, base, status, stock, records } = await setup();
    const [drill, saw] = records;

    const result = (
      await owner
        .patch(`${base}/records/batch`)
        .send({
          ids: [drill.id, saw.id],
          data: { [status.id]: 'Agotado', [stock.id]: 0 },
        })
        .expect(200)
    ).body as RecordBatchResult;
    expect(result).toEqual({ count: 2 });

    const data = await dataOf(owner, base);
    expect(data.map((cells) => cells[status.id])).toEqual([
      'Agotado',
      'Agotado',
      'Disponible',
    ]);
    // Emptying a cell removes it, as a single edit does.
    await owner
      .patch(`${base}/records/batch`)
      .send({ ids: [drill.id], data: { [status.id]: null } })
      .expect(200);
    const [emptied] = await dataOf(owner, base);
    expect(emptied).not.toHaveProperty(status.id);

    const activity = (await owner.get(`${base}/activity`).expect(200))
      .body as ActivityPage;
    expect(
      activity.data.filter(({ action }) => action === 'record.updated'),
    ).toHaveLength(3);
    // The stock that went to zero is in each record's history.
    expect(
      await prisma.stockMovement.count({
        where: { recordId: { in: [drill.id, saw.id] }, delta: -5 },
      }),
    ).toBe(2);
  });

  it('is all or nothing: a bad value, a record of another table or a repeated unique value change nothing', async () => {
    const { owner, base, status, sku, records } = await setup();
    const ids = records.map(({ id }) => id);
    const before = await dataOf(owner, base);

    await owner
      .patch(`${base}/records/batch`)
      .send({ ids, data: { [status.id]: 'Roto' } })
      .expect(400);
    const other = await setup();
    await owner
      .patch(`${base}/records/batch`)
      .send({
        ids: [ids[0], other.records[0].id],
        data: { [status.id]: 'Agotado' },
      })
      .expect(404);
    // One SKU can't go to three records.
    await owner
      .patch(`${base}/records/batch`)
      .send({ ids, data: { [sku.id]: 'SKU-9' } })
      .expect(409);
    await owner
      .patch(`${base}/records/batch`)
      .send({ ids, data: {} })
      .expect(400);
    await owner
      .patch(`${base}/records/batch`)
      .send({ ids: [ids[0], ids[0]], data: { [status.id]: 'Agotado' } })
      .expect(400);

    expect(await dataOf(owner, base)).toEqual(before);
  });

  it('deletes the selected records, unlinking them elsewhere', async () => {
    const { owner, base, table, records } = await setup();
    const orders = (
      await owner.post('/api/tables').send({ name: 'Pedidos' }).expect(201)
    ).body as TableDetail;
    const products = (
      await owner
        .post(`/api/tables/${orders.id}/columns`)
        .send({
          name: 'Productos',
          type: 'relation',
          options: { tableId: table.id, multiple: true },
        })
        .expect(201)
    ).body as TableColumn;
    await owner
      .post(`/api/tables/${orders.id}/records`)
      .send({ data: { [products.id]: records.map(({ id }) => id) } })
      .expect(201);

    const result = (
      await owner
        .post(`${base}/records/batch-delete`)
        .send({ ids: [records[0].id, records[1].id] })
        .expect(200)
    ).body as RecordBatchResult;
    expect(result).toEqual({ count: 2 });

    expect(await dataOf(owner, base)).toHaveLength(1);
    const [order] = await dataOf(owner, `/api/tables/${orders.id}`);
    expect(order[products.id]).toEqual([records[2].id]);
    const activity = (await owner.get(`${base}/activity`).expect(200))
      .body as ActivityPage;
    expect(
      activity.data.filter(({ action }) => action === 'record.deleted'),
    ).toHaveLength(2);
  });

  it('needs editing rights, and hides other tables', async () => {
    const { table, base, status, records } = await setup();
    const ids = [records[0].id];
    const viewer = await createSignedInClient(app);
    const viewerId = (
      (await viewer.get('/api/auth/me').expect(200)).body as AuthUser
    ).id;
    await prisma.tableShare.create({
      data: { tableId: table.id, userId: viewerId, role: 'VIEWER' },
    });

    await viewer
      .patch(`${base}/records/batch`)
      .send({ ids, data: { [status.id]: 'Agotado' } })
      .expect(403);
    await viewer.post(`${base}/records/batch-delete`).send({ ids }).expect(403);

    const stranger = await createSignedInClient(app);
    await stranger
      .post(`${base}/records/batch-delete`)
      .send({ ids })
      .expect(404);
    await stranger
      .patch(`${base}/records/batch`)
      .send({
        ids: Array.from({ length: 101 }, () => crypto.randomUUID()),
        data: {},
      })
      .expect(400);
  });
});
