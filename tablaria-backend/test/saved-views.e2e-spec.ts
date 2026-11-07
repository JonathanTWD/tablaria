import { INestApplication } from '@nestjs/common';
import {
  type AuthUser,
  MAX_SAVED_VIEWS_PER_TABLE,
  type SavedView,
  type TableColumn,
  type TableDetail,
} from '@tablaria/shared';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import {
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

describe('Saved views (e2e)', () => {
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

  async function setup() {
    const owner = await createSignedInClient(app);
    const table = (
      await owner.post('/api/tables').send({ name: 'Productos' }).expect(201)
    ).body as TableDetail;
    const base = `/api/tables/${table.id}`;
    const stock = (
      await owner
        .post(`${base}/columns`)
        .send({ name: 'Stock', type: 'number' })
        .expect(201)
    ).body as TableColumn;
    const lowStock = {
      search: 'taladro',
      sort: stock.id,
      order: 'desc',
      filters: [{ columnId: stock.id, op: 'between', max: 5 }],
      pageSize: 25,
    };
    return { owner, table, base, stock, lowStock };
  }

  async function share(table: TableDetail, client: TestClient, role: 'VIEWER') {
    const user = (await client.get('/api/auth/me').expect(200))
      .body as AuthUser;
    await prisma.tableShare.create({
      data: { tableId: table.id, userId: user.id, role },
    });
  }

  it('saves a view with a name, lists it for the table and applies defaults', async () => {
    const { owner, base, lowStock } = await setup();

    const saved = (
      await owner
        .post(`${base}/views`)
        .send({ name: '  Bajo stock ', view: lowStock })
        .expect(201)
    ).body as SavedView;
    expect(saved).toMatchObject({ name: 'Bajo stock', view: lowStock });
    expect(saved.createdBy).toEqual(expect.any(String));

    await owner
      .post(`${base}/views`)
      .send({ name: 'Todo', view: {} })
      .expect(201);
    const views = (await owner.get(`${base}/views`).expect(200))
      .body as SavedView[];
    expect(views.map(({ name }) => name)).toEqual(['Bajo stock', 'Todo']);
    expect(views[1].view).toEqual({
      search: '',
      order: 'asc',
      filters: [],
      pageSize: 10,
    });
  });

  it('renames a view, saves over it and deletes it', async () => {
    const { owner, base, lowStock } = await setup();
    const saved = (
      await owner
        .post(`${base}/views`)
        .send({ name: 'Bajo stock', view: lowStock })
        .expect(201)
    ).body as SavedView;

    const renamed = (
      await owner
        .patch(`${base}/views/${saved.id}`)
        .send({ name: 'Reponer', view: { ...lowStock, search: '' } })
        .expect(200)
    ).body as SavedView;
    expect(renamed).toMatchObject({ name: 'Reponer', view: { search: '' } });

    await owner.patch(`${base}/views/${saved.id}`).send({}).expect(400);
    await owner.delete(`${base}/views/${saved.id}`).expect(204);
    await owner.delete(`${base}/views/${saved.id}`).expect(404);
  });

  it('refuses repeated names, columns of other tables and too many views', async () => {
    const { owner, base, lowStock } = await setup();
    await owner
      .post(`${base}/views`)
      .send({ name: 'Bajo stock', view: lowStock })
      .expect(201);
    await owner
      .post(`${base}/views`)
      .send({ name: 'Bajo stock', view: {} })
      .expect(409);
    await owner
      .post(`${base}/views`)
      .send({ name: 'Ajena', view: { sort: randomUUID() } })
      .expect(400);

    for (let index = 1; index < MAX_SAVED_VIEWS_PER_TABLE; index++) {
      await owner
        .post(`${base}/views`)
        .send({ name: `Vista ${index}`, view: {} })
        .expect(201);
    }
    await owner
      .post(`${base}/views`)
      .send({ name: 'Una más', view: {} })
      .expect(422);
  });

  it('lets viewers open views, but only editors change them', async () => {
    const { owner, table, base, lowStock } = await setup();
    const saved = (
      await owner
        .post(`${base}/views`)
        .send({ name: 'Bajo stock', view: lowStock })
        .expect(201)
    ).body as SavedView;
    const viewer = await createSignedInClient(app);
    await share(table, viewer, 'VIEWER');

    expect(
      ((await viewer.get(`${base}/views`).expect(200)).body as SavedView[])
        .length,
    ).toBe(1);
    await viewer
      .post(`${base}/views`)
      .send({ name: 'Mía', view: {} })
      .expect(403);
    await viewer
      .patch(`${base}/views/${saved.id}`)
      .send({ name: 'Mía' })
      .expect(403);
    await viewer.delete(`${base}/views/${saved.id}`).expect(403);

    const stranger = await createSignedInClient(app);
    await stranger.get(`${base}/views`).expect(404);
    // A view id of another table is not found through this one.
    const other = await setup();
    await other.owner
      .patch(`${other.base}/views/${saved.id}`)
      .send({ name: 'Robada' })
      .expect(404);
  });
});
