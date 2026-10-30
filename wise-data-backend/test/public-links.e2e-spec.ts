import { INestApplication } from '@nestjs/common';
import type {
  AuthUser,
  CreatedPublicLink,
  PublicLinkStatus,
  PublicTable,
  TableColumn,
  TableDetail,
} from '@wisedata/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import {
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

describe('Public links (e2e)', () => {
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

  /** A catalog with a name, a stock and a relation to a supplier list. */
  async function setup() {
    const owner = await createSignedInClient(app);
    const createTable = async (name: string) =>
      (await owner.post('/api/tables').send({ name }).expect(201))
        .body as TableDetail;
    const suppliers = await createTable('Proveedores');
    const table = await createTable('Catálogo');
    const base = `/api/tables/${table.id}`;
    const addColumn = async (body: object) =>
      (await owner.post(`${base}/columns`).send(body).expect(201))
        .body as TableColumn;
    const name = await addColumn({ name: 'Producto', type: 'text' });
    const stock = await addColumn({ name: 'Stock', type: 'number' });
    const supplier = await addColumn({
      name: 'Proveedor',
      type: 'relation',
      options: { tableId: suppliers.id },
    });
    const supplierRecord = (
      await owner
        .post(`/api/tables/${suppliers.id}/records`)
        .send({ data: {} })
        .expect(201)
    ).body as { id: string };
    for (const [product, units] of [
      ['Taladro', 3],
      ['Sierra', 8],
    ] as const) {
      await owner
        .post(`${base}/records`)
        .send({
          data: {
            [name.id]: product,
            [stock.id]: units,
            [supplier.id]: supplierRecord.id,
          },
        })
        .expect(201);
    }
    return { owner, table, base, name, stock, supplier };
  }

  function readPublic(token: string, query = '') {
    return request(app.getHttpServer())
      .get(`/api/public/table${query}`)
      .set('x-public-token', token);
  }

  async function createLink(client: TestClient, base: string) {
    return (await client.put(`${base}/public-link`).expect(200))
      .body as CreatedPublicLink;
  }

  it('shows the table read-only to anyone with the link, without relations', async () => {
    const { owner, base, name, stock, supplier } = await setup();
    const { token } = await createLink(owner, base);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(
      (
        (await owner.get(`${base}/public-link`).expect(200))
          .body as PublicLinkStatus
      ).enabled,
    ).toBe(true);

    const response = await readPublic(token, '?sort=' + stock.id).expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-robots-tag']).toBe('noindex');
    const shared = response.body as PublicTable;
    expect(shared.name).toBe('Catálogo');
    expect(shared.columns.map(({ name: column }) => column)).toEqual([
      'Producto',
      'Stock',
    ]);
    expect(shared.records.data.map(({ data }) => data)).toEqual([
      { [name.id]: 'Taladro', [stock.id]: 3 },
      { [name.id]: 'Sierra', [stock.id]: 8 },
    ]);
    const searched = (await readPublic(token, '?search=sier').expect(200))
      .body as PublicTable;
    expect(searched.records.meta.total).toBe(1);
    // The hidden relation can't be used to sort or filter either.
    await readPublic(token, '?sort=' + supplier.id).expect(400);
  });

  it('stops working when the link is replaced or turned off', async () => {
    const { owner, base } = await setup();
    const first = await createLink(owner, base);
    const second = await createLink(owner, base);

    await readPublic(first.token).expect(404);
    await readPublic(second.token).expect(200);
    await owner.delete(`${base}/public-link`).expect(204);
    await readPublic(second.token).expect(404);
    expect(
      (
        (await owner.get(`${base}/public-link`).expect(200))
          .body as PublicLinkStatus
      ).enabled,
    ).toBe(false);
    await owner.delete(`${base}/public-link`).expect(404);
    // Malformed or missing tokens are just links that don't exist.
    await readPublic('not-a-token').expect(404);
    await request(app.getHttpServer()).get('/api/public/table').expect(404);
  });

  it('lets only admins of real accounts manage the link', async () => {
    const { owner, table, base } = await setup();
    const editor = await createSignedInClient(app);
    const stranger = await createSignedInClient(app);
    const prisma = app.get(PrismaService);
    const editorUser = (await editor.get('/api/auth/me').expect(200))
      .body as AuthUser;
    await prisma.tableShare.create({
      data: { tableId: table.id, userId: editorUser.id, role: 'EDITOR' },
    });

    await editor.put(`${base}/public-link`).expect(403);
    await editor.get(`${base}/public-link`).expect(403);
    await stranger.put(`${base}/public-link`).expect(404);
    const ownerUser = (await owner.get('/api/auth/me').expect(200))
      .body as AuthUser;
    await prisma.user.update({
      where: { id: ownerUser.id },
      data: { demoExpiresAt: new Date(Date.now() + 60 * 60_000) },
    });
    await owner.put(`${base}/public-link`).expect(403);
  });
});
