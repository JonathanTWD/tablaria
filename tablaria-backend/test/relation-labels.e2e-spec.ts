import { INestApplication } from '@nestjs/common';
import type {
  AuthUser,
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

describe('Relations by label (e2e)', () => {
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

  async function createTable(client: TestClient, name: string) {
    return (await client.post('/api/tables').send({ name }).expect(201))
      .body as TableDetail;
  }

  async function addColumn(client: TestClient, tableId: string, body: object) {
    return (
      await client.post(`/api/tables/${tableId}/columns`).send(body).expect(201)
    ).body as TableColumn;
  }

  async function addRecord(client: TestClient, tableId: string, data: object) {
    return (
      await client
        .post(`/api/tables/${tableId}/records`)
        .send({ data })
        .expect(201)
    ).body as TableRecord;
  }

  /** Products from three suppliers, and one without a supplier. */
  async function setup() {
    const owner = await createSignedInClient(app);
    const suppliers = await createTable(owner, 'Proveedores');
    const supplierName = await addColumn(owner, suppliers.id, {
      name: 'Nombre',
      type: 'text',
    });
    const supplierIds: Record<string, string> = {};
    for (const name of ['Makita', 'Bosch', 'Würth']) {
      supplierIds[name] = (
        await addRecord(owner, suppliers.id, { [supplierName.id]: name })
      ).id;
    }
    const products = await createTable(owner, 'Productos');
    const product = await addColumn(owner, products.id, {
      name: 'Producto',
      type: 'text',
    });
    const supplier = await addColumn(owner, products.id, {
      name: 'Proveedor',
      type: 'relation',
      options: { tableId: suppliers.id },
    });
    for (const [name, from] of [
      ['Taladro', 'Bosch'],
      ['Sierra', 'Makita'],
      ['Tornillos', 'Würth'],
      ['Cinta', null],
    ] as const) {
      await addRecord(owner, products.id, {
        [product.id]: name,
        ...(from && { [supplier.id]: supplierIds[from] }),
      });
    }
    return { owner, products, product, supplier };
  }

  function list(client: TestClient, tableId: string, query: object) {
    return client
      .get(`/api/tables/${tableId}/records`)
      .query({ pageSize: 100, ...query });
  }

  function names(page: RecordPage, productColumn: TableColumn) {
    return page.data.map(({ data }) => data[productColumn.id]);
  }

  it('searches, filters and sorts by the linked record’s label', async () => {
    const { owner, products, product, supplier } = await setup();

    const all = (await list(owner, products.id, {}).expect(200))
      .body as RecordPage;
    expect(all.labelledRelations).toEqual([supplier.id]);

    const searched = (
      await list(owner, products.id, { search: 'bos' }).expect(200)
    ).body as RecordPage;
    expect(names(searched, product)).toEqual(['Taladro']);

    const filters = JSON.stringify([
      { columnId: supplier.id, op: 'contains', value: 'w' },
    ]);
    const filtered = (await list(owner, products.id, { filters }).expect(200))
      .body as RecordPage;
    expect(names(filtered, product)).toEqual(['Tornillos']);

    // By label, and records without a link last whatever the direction.
    const ascending = (
      await list(owner, products.id, { sort: supplier.id }).expect(200)
    ).body as RecordPage;
    expect(names(ascending, product)).toEqual([
      'Taladro',
      'Sierra',
      'Tornillos',
      'Cinta',
    ]);
    const descending = (
      await list(owner, products.id, {
        sort: supplier.id,
        order: 'desc',
      }).expect(200)
    ).body as RecordPage;
    expect(names(descending, product)).toEqual([
      'Tornillos',
      'Sierra',
      'Taladro',
      'Cinta',
    ]);

    const csv = await owner
      .get(`/api/tables/${products.id}/records/export`)
      .query({ sort: supplier.id, filters })
      .expect(200);
    expect(csv.text).toContain('Tornillos;Würth');
    expect(csv.text).not.toContain('Taladro');
  });

  it('never uses labels of a table the user can’t open', async () => {
    const { products, product, supplier } = await setup();
    const viewer = await createSignedInClient(app);
    const viewerUser = (await viewer.get('/api/auth/me').expect(200))
      .body as AuthUser;
    // Products are shared with them, suppliers aren't.
    await app.get(PrismaService).tableShare.create({
      data: { tableId: products.id, userId: viewerUser.id, role: 'VIEWER' },
    });

    const all = (await list(viewer, products.id, {}).expect(200))
      .body as RecordPage;
    expect(all.labelledRelations).toEqual([]);
    expect(all.linked).toEqual({});
    // A search that would only match a supplier's name finds nothing.
    const searched = (
      await list(viewer, products.id, { search: 'bosch' }).expect(200)
    ).body as RecordPage;
    expect(names(searched, product)).toEqual([]);

    const filters = JSON.stringify([
      { columnId: supplier.id, op: 'contains', value: 'b' },
    ]);
    await list(viewer, products.id, { filters }).expect(403);
    await list(viewer, products.id, { sort: supplier.id }).expect(403);
    await viewer
      .get(`/api/tables/${products.id}/records/export`)
      .query({ sort: supplier.id })
      .expect(403);
  });
});
