import { INestApplication } from '@nestjs/common';
import type {
  RecordDetail,
  TableColumn,
  TableDetail,
  TableRecord,
} from '@tablaria/shared';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types';
import {
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

describe('One record (e2e)', () => {
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

  it('opens one record as a page shows it, computed columns included', async () => {
    const owner = await createSignedInClient(app);
    const suppliers = await createTable(owner, 'Proveedores');
    const supplierName = await addColumn(owner, suppliers.id, {
      name: 'Nombre',
      type: 'text',
    });
    const bosch = await addRecord(owner, suppliers.id, {
      [supplierName.id]: 'Bosch',
    });
    const products = await createTable(owner, 'Productos');
    const name = await addColumn(owner, products.id, {
      name: 'Producto',
      type: 'text',
    });
    const price = await addColumn(owner, products.id, {
      name: 'Precio',
      type: 'number',
    });
    const stock = await addColumn(owner, products.id, {
      name: 'Stock',
      type: 'number',
    });
    const supplier = await addColumn(owner, products.id, {
      name: 'Proveedor',
      type: 'relation',
      options: { tableId: suppliers.id },
    });
    const value = await addColumn(owner, products.id, {
      name: 'Valor',
      type: 'formula',
      options: { expression: '{Precio} * {Stock}' },
    });
    const drill = await addRecord(owner, products.id, {
      [name.id]: 'Taladro',
      [price.id]: 90,
      [stock.id]: 3,
      [supplier.id]: bosch.id,
    });

    const detail = (
      await owner
        .get(`/api/tables/${products.id}/records/${drill.id}`)
        .expect(200)
    ).body as RecordDetail;
    expect(detail.record).toMatchObject({
      id: drill.id,
      data: { [name.id]: 'Taladro', [value.id]: 270 },
    });
    expect(detail.linked).toEqual({ [bosch.id]: 'Bosch' });

    // A record of another table, or none at all, is not found here.
    await owner
      .get(`/api/tables/${products.id}/records/${bosch.id}`)
      .expect(404);
    await owner
      .get(`/api/tables/${products.id}/records/${randomUUID()}`)
      .expect(404);
    await owner.get(`/api/tables/${products.id}/records/not-an-id`).expect(400);
    // Nor by someone who can't open the table.
    const stranger = await createSignedInClient(app);
    await stranger
      .get(`/api/tables/${products.id}/records/${drill.id}`)
      .expect(404);
  });
});
