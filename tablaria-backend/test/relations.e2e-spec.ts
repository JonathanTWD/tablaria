import { INestApplication } from '@nestjs/common';
import type {
  AuthUser,
  OrganizationDetail,
  RecordPage,
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
import { extractToken, latestEmail } from './helpers/mailpit';

describe('Relations between tables (e2e)', () => {
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

  async function addRecord(
    client: TestClient,
    tableId: string,
    data: object,
    status = 201,
  ) {
    return (
      await client
        .post(`/api/tables/${tableId}/records`)
        .send({ data })
        .expect(status)
    ).body as TableRecord;
  }

  async function list(client: TestClient, tableId: string) {
    return (await client.get(`/api/tables/${tableId}/records`).expect(200))
      .body as RecordPage;
  }

  /** Products linked to suppliers, both in the owner's personal space. */
  async function setup() {
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
    const productName = await addColumn(owner, products.id, {
      name: 'Producto',
      type: 'text',
    });
    const supplier = await addColumn(owner, products.id, {
      name: 'Proveedor',
      type: 'relation',
      options: { tableId: suppliers.id },
    });
    return { owner, suppliers, bosch, products, productName, supplier };
  }

  it('links records and lists them with the label of what they link to', async () => {
    const { owner, suppliers, bosch, products, productName, supplier } =
      await setup();

    await addRecord(owner, products.id, {
      [productName.id]: 'Taladro',
      [supplier.id]: bosch.id,
    });
    // Only records of the linked table: not made-up ids, not other tables.
    await addRecord(owner, products.id, { [supplier.id]: randomUUID() }, 422);
    const product = (await list(owner, products.id)).data[0];
    await addRecord(owner, products.id, { [supplier.id]: product.id }, 422);
    await addRecord(owner, products.id, { [supplier.id]: 'Bosch' }, 400);

    const page = await list(owner, products.id);
    expect(page.data[0].data[supplier.id]).toBe(bosch.id);
    expect(page.linked).toEqual({ [bosch.id]: 'Bosch' });

    const csv = await owner
      .get(`/api/tables/${products.id}/records/export`)
      .expect(200);
    expect(csv.text).toContain('Taladro;Bosch');
    expect(suppliers.id).toBeDefined();
  });

  it('links only to tables of the same space', async () => {
    const { owner, products } = await setup();
    const organization = (
      await owner
        .post('/api/organizations')
        .send({ name: 'Tienda' })
        .expect(201)
    ).body as OrganizationDetail;
    const elsewhere = (
      await owner
        .post(`/api/organizations/${organization.id}/tables`)
        .send({ name: 'Ajena' })
        .expect(201)
    ).body as TableDetail;

    await owner
      .post(`/api/tables/${products.id}/columns`)
      .send({
        name: 'Ajena',
        type: 'relation',
        options: { tableId: elsewhere.id },
      })
      .expect(422);
    await owner
      .post(`/api/tables/${products.id}/columns`)
      .send({
        name: 'Ninguna',
        type: 'relation',
        options: { tableId: randomUUID() },
      })
      .expect(422);
  });

  it('never shows what a link points to without access to that table', async () => {
    const { owner, bosch, products, productName, supplier } = await setup();
    await addRecord(owner, products.id, {
      [productName.id]: 'Taladro',
      [supplier.id]: bosch.id,
    });
    // An editor of the products, but not of the suppliers.
    const guest = await createSignedInClient(app);
    const guestUser = (await guest.get('/api/auth/me').expect(200))
      .body as AuthUser;
    await owner
      .post(`/api/tables/${products.id}/invitations`)
      .send({ email: guestUser.email, role: 'EDITOR' })
      .expect(201);
    const token = extractToken(await latestEmail(guestUser.email));
    await guest.post('/api/invitations/accept').send({ token }).expect(200);

    const page = await list(guest, products.id);
    expect(page.data[0].data[supplier.id]).toBe(bosch.id);
    expect(page.linked).toEqual({});
    // Nor can they link to it: they can't open the table to choose a record.
    await addRecord(guest, products.id, { [supplier.id]: bosch.id }, 403);
    await addRecord(guest, products.id, { [productName.id]: 'Sierra' });
  });

  it('empties links to deleted records, and drops relations to deleted tables', async () => {
    const { owner, suppliers, bosch, products, productName, supplier } =
      await setup();
    await addRecord(owner, products.id, {
      [productName.id]: 'Taladro',
      [supplier.id]: bosch.id,
    });

    await owner
      .delete(`/api/tables/${suppliers.id}/records/${bosch.id}`)
      .expect(204);
    const page = await list(owner, products.id);
    expect(page.data[0].data).toEqual({ [productName.id]: 'Taladro' });

    await owner.delete(`/api/tables/${suppliers.id}`).expect(204);
    const detail = (await owner.get(`/api/tables/${products.id}`).expect(200))
      .body as TableDetail;
    expect(detail.columns.map(({ name }) => name)).toEqual(['Producto']);
  });

  it('empties the links when the column changes the table it links to', async () => {
    const { owner, bosch, products, productName, supplier } = await setup();
    await addRecord(owner, products.id, {
      [productName.id]: 'Taladro',
      [supplier.id]: bosch.id,
    });
    const other = await createTable(owner, 'Fabricantes');

    await owner
      .patch(`/api/tables/${products.id}/columns/${supplier.id}`)
      .send({ options: { tableId: other.id } })
      .expect(200);

    const page = await list(owner, products.id);
    expect(page.data[0].data).toEqual({ [productName.id]: 'Taladro' });
  });
});
