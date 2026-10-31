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

describe('Lookup columns (e2e)', () => {
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

  /** Products linked to suppliers, with the supplier's phone and lead time as lookups. */
  async function setup() {
    const owner = await createSignedInClient(app);
    const suppliers = await createTable(owner, 'Proveedores');
    const supplierName = await addColumn(owner, suppliers.id, {
      name: 'Nombre',
      type: 'text',
    });
    const phone = await addColumn(owner, suppliers.id, {
      name: 'Teléfono',
      type: 'text',
    });
    const days = await addColumn(owner, suppliers.id, {
      name: 'Plazo',
      type: 'number',
    });
    const supplierIds: Record<string, string> = {};
    for (const [name, tel, lead] of [
      ['Bosch', '912 000 111', 3],
      ['Makita', '934 000 222', 10],
    ] as const) {
      supplierIds[name] = (
        await addRecord(owner, suppliers.id, {
          [supplierName.id]: name,
          [phone.id]: tel,
          [days.id]: lead,
        })
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
    const phoneLookup = await addColumn(owner, products.id, {
      name: 'Teléfono del proveedor',
      type: 'lookup',
      options: { relationColumnId: supplier.id, targetColumnId: phone.id },
    });
    const daysLookup = await addColumn(owner, products.id, {
      name: 'Plazo del proveedor',
      type: 'lookup',
      options: { relationColumnId: supplier.id, targetColumnId: days.id },
    });
    for (const [name, from] of [
      ['Taladro', 'Makita'],
      ['Sierra', 'Bosch'],
      ['Cinta', null],
    ] as const) {
      await addRecord(owner, products.id, {
        [product.id]: name,
        ...(from && { [supplier.id]: supplierIds[from] }),
      });
    }
    return {
      owner,
      suppliers,
      phone,
      days,
      supplierIds,
      products,
      product,
      supplier,
      phoneLookup,
      daysLookup,
    };
  }

  function list(client: TestClient, tableId: string, query: object = {}) {
    return client.get(`/api/tables/${tableId}/records`).query(query);
  }

  it('shows a column of the linked record, always up to date', async () => {
    const s = await setup();
    const page = (await list(s.owner, s.products.id).expect(200))
      .body as RecordPage;
    expect(
      page.data.map(({ data }) => [
        data[s.product.id],
        data[s.phoneLookup.id] ?? null,
        data[s.daysLookup.id] ?? null,
      ]),
    ).toEqual([
      ['Taladro', '934 000 222', 10],
      ['Sierra', '912 000 111', 3],
      ['Cinta', null, null],
    ]);

    // Read when listing, never stored: a change in the supplier shows at once.
    await s.owner
      .patch(`/api/tables/${s.suppliers.id}/records/${s.supplierIds.Bosch}`)
      .send({ data: { [s.phone.id]: '911 999 999' } })
      .expect(200);
    const after = (await list(s.owner, s.products.id).expect(200))
      .body as RecordPage;
    expect(after.data[1].data[s.phoneLookup.id]).toBe('911 999 999');

    const detail = (
      await s.owner.get(`/api/tables/${s.products.id}`).expect(200)
    ).body as TableDetail;
    expect(detail.lookupTargets[s.daysLookup.id]).toMatchObject({
      name: 'Plazo',
      type: 'number',
    });

    const csv = await s.owner
      .get(`/api/tables/${s.products.id}/records/export`)
      .expect(200);
    expect(csv.text).toContain('Taladro;Makita;934 000 222;10');
  });

  it('sorts, filters and searches by what a lookup shows', async () => {
    const s = await setup();
    const names = (page: RecordPage) =>
      page.data.map(({ data }) => data[s.product.id]);

    // By value: 3 days before 10, empty last.
    const sorted = (
      await list(s.owner, s.products.id, { sort: s.daysLookup.id }).expect(200)
    ).body as RecordPage;
    expect(names(sorted)).toEqual(['Sierra', 'Taladro', 'Cinta']);
    const filters = JSON.stringify([
      { columnId: s.phoneLookup.id, op: 'contains', value: '934' },
    ]);
    const filtered = (
      await list(s.owner, s.products.id, { filters }).expect(200)
    ).body as RecordPage;
    expect(names(filtered)).toEqual(['Taladro']);
    const searched = (
      await list(s.owner, s.products.id, { search: '912' }).expect(200)
    ).body as RecordPage;
    expect(names(searched)).toEqual(['Sierra']);
  });

  it('is never written, and only reads plain columns through a relation', async () => {
    const s = await setup();
    await s.owner
      .post(`/api/tables/${s.products.id}/records`)
      .send({ data: { [s.phoneLookup.id]: '600 000 000' } })
      .expect(400);

    const lookup = (body: object) =>
      s.owner.post(`/api/tables/${s.products.id}/columns`).send({
        name: 'Otra',
        type: 'lookup',
        ...body,
      });
    // Through a column that isn't a relation.
    await lookup({
      options: { relationColumnId: s.product.id, targetColumnId: s.phone.id },
    }).expect(422);
    // Showing a column of another table than the linked one.
    await lookup({
      options: {
        relationColumnId: s.supplier.id,
        targetColumnId: s.product.id,
      },
    }).expect(422);
    // Showing another relation.
    await lookup({
      options: {
        relationColumnId: s.supplier.id,
        targetColumnId: s.supplier.id,
      },
    }).expect(422);
    await lookup({
      required: true,
      options: { relationColumnId: s.supplier.id, targetColumnId: s.phone.id },
    }).expect(400);

    // A lookup stays one, and nothing becomes one.
    await s.owner
      .patch(`/api/tables/${s.products.id}/columns/${s.phoneLookup.id}`)
      .send({ type: 'text' })
      .expect(400);
    await s.owner
      .patch(`/api/tables/${s.products.id}/columns/${s.product.id}`)
      .send({
        type: 'lookup',
        options: {
          relationColumnId: s.supplier.id,
          targetColumnId: s.phone.id,
        },
      })
      .expect(400);
  });

  it('shows nothing of a table the user can’t open', async () => {
    const s = await setup();
    const viewer = await createSignedInClient(app);
    const viewerUser = (await viewer.get('/api/auth/me').expect(200))
      .body as AuthUser;
    await app.get(PrismaService).tableShare.create({
      data: { tableId: s.products.id, userId: viewerUser.id, role: 'VIEWER' },
    });

    const page = (await list(viewer, s.products.id).expect(200))
      .body as RecordPage;
    expect(page.data.every(({ data }) => !(s.phoneLookup.id in data))).toBe(
      true,
    );
    const detail = (
      await viewer.get(`/api/tables/${s.products.id}`).expect(200)
    ).body as TableDetail;
    expect(detail.lookupTargets).toEqual({});
    await list(viewer, s.products.id, { sort: s.daysLookup.id }).expect(403);
    const searched = (
      await list(viewer, s.products.id, { search: '912' }).expect(200)
    ).body as RecordPage;
    expect(searched.data).toEqual([]);
  });

  it('goes away with the relation or the column it reads', async () => {
    const s = await setup();
    const columnsOf = async () =>
      (
        (await s.owner.get(`/api/tables/${s.products.id}`).expect(200))
          .body as TableDetail
      ).columns.map(({ name }) => name);

    // The column it shows is deleted in the other table.
    await s.owner
      .delete(`/api/tables/${s.suppliers.id}/columns/${s.days.id}`)
      .expect(204);
    expect(await columnsOf()).toEqual([
      'Producto',
      'Proveedor',
      'Teléfono del proveedor',
    ]);
    // The relation it reads through is deleted.
    await s.owner
      .delete(`/api/tables/${s.products.id}/columns/${s.supplier.id}`)
      .expect(204);
    expect(await columnsOf()).toEqual(['Producto']);
  });

  it('goes away when the linked table is deleted', async () => {
    const s = await setup();
    await s.owner.delete(`/api/tables/${s.suppliers.id}`).expect(204);
    const detail = (
      await s.owner.get(`/api/tables/${s.products.id}`).expect(200)
    ).body as TableDetail;
    expect(detail.columns.map(({ name }) => name)).toEqual(['Producto']);
  });
});
