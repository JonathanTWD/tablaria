import { INestApplication } from '@nestjs/common';
import type {
  ActivityPage,
  AuthUser,
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

describe('Activity history (e2e)', () => {
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

  async function setup() {
    const owner = await createSignedInClient(app);
    const table = (
      await owner.post('/api/tables').send({ name: 'Almacén' }).expect(201)
    ).body as TableDetail;
    const base = `/api/tables/${table.id}`;
    const addColumn = async (body: object) =>
      (await owner.post(`${base}/columns`).send(body).expect(201))
        .body as TableColumn;
    const name = await addColumn({ name: 'Producto', type: 'text' });
    const stock = await addColumn({
      name: 'Stock',
      type: 'number',
      stock: true,
    });
    return { owner, table, base, name, stock };
  }

  async function activity(client: TestClient, base: string, page = 1) {
    return (await client.get(`${base}/activity?page=${page}`).expect(200))
      .body as ActivityPage;
  }

  /** The events as [action, label, details], newest first. */
  async function summary(client: TestClient, base: string) {
    return (await activity(client, base)).data.map(
      ({ action, label, details }) => [action, label, details],
    );
  }

  it('keeps who changed which record, merging edits made in a row', async () => {
    const { owner, base, name, stock } = await setup();
    const me = (await owner.get('/api/auth/me').expect(200)).body as AuthUser;
    const record = (
      await owner
        .post(`${base}/records`)
        .send({ data: { [name.id]: 'Taladro', [stock.id]: 3 } })
        .expect(201)
    ).body as TableRecord;
    const patch = (data: object) =>
      owner.patch(`${base}/records/${record.id}`).send({ data }).expect(200);
    await patch({ [stock.id]: 4 });
    await patch({ [name.id]: 'Taladro 750 W' });
    // Saving the same value again changes nothing worth telling.
    await patch({ [stock.id]: 4 });
    await owner
      .post(`${base}/records/${record.id}/movements`)
      .send({ columnId: stock.id, kind: 'out', quantity: 1, note: null })
      .expect(201);
    await owner.delete(`${base}/records/${record.id}`).expect(204);

    const page = await activity(owner, base);
    expect(page.data[0]).toMatchObject({
      by: me.email.split('@')[0],
      mine: true,
    });
    expect(
      page.data.map(({ action, label, details }) => [action, label, details]),
    ).toEqual([
      ['record.deleted', 'Taladro 750 W', {}],
      [
        'stock.moved',
        'Taladro 750 W',
        { kind: 'out', delta: -1, column: 'Stock' },
      ],
      ['record.updated', 'Taladro 750 W', { columns: ['Stock', 'Producto'] }],
      ['record.created', 'Taladro', {}],
      ['column.created', 'Stock', {}],
      ['column.created', 'Producto', {}],
    ]);
  });

  it('keeps column changes and imports as one event each', async () => {
    const { owner, base, name, stock } = await setup();
    await owner
      .patch(`${base}/columns/${stock.id}`)
      .send({ name: 'Unidades' })
      .expect(200);
    await owner
      .post(`${base}/import`)
      .send({
        columns: [name.id, stock.id],
        rows: [
          ['Sierra', '2'],
          ['Martillo', '5'],
        ],
      })
      .expect(201);
    await owner.delete(`${base}/columns/${stock.id}`).expect(204);

    expect((await summary(owner, base)).slice(0, 3)).toEqual([
      ['column.deleted', 'Unidades', {}],
      ['records.imported', null, { created: 2, updated: 0 }],
      ['column.updated', 'Unidades', { renamedFrom: 'Stock' }],
    ]);
  });

  it('shows the history to anyone who can open the table, page by page', async () => {
    const { owner, table, base, name } = await setup();
    const viewer = await createSignedInClient(app);
    const stranger = await createSignedInClient(app);
    const viewerUser = (await viewer.get('/api/auth/me').expect(200))
      .body as AuthUser;
    await app.get(PrismaService).tableShare.create({
      data: { tableId: table.id, userId: viewerUser.id, role: 'VIEWER' },
    });
    for (let index = 0; index < 30; index++) {
      await owner
        .post(`${base}/records`)
        .send({ data: { [name.id]: `Producto ${index}` } })
        .expect(201);
    }

    const second = await activity(viewer, base, 2);
    expect(second.meta).toMatchObject({ page: 2, total: 32, pageCount: 2 });
    expect(second.data.map(({ label }) => label)).toEqual([
      'Stock',
      'Producto',
    ]);
    await stranger.get(`${base}/activity`).expect(404);
    await owner.get(`${base}/activity?page=0`).expect(400);
  });
});
