import { INestApplication } from '@nestjs/common';
import type {
  AuthUser,
  ImportCheck,
  RecordPage,
  TableColumn,
  TableDetail,
} from '@tablaria/shared';
import ExcelJS from 'exceljs';
import { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import {
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

describe('Importing relations by name (e2e)', () => {
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

  /** Suppliers named by their first column, and products that link to them. */
  async function setup() {
    const owner = await createSignedInClient(app);
    const suppliers = await createTable(owner, 'Proveedores');
    const supplierName = await addColumn(owner, suppliers.id, {
      name: 'Nombre',
      type: 'text',
    });
    const ids: Record<string, string> = {};
    for (const name of ['Bosch', 'Makita', 'Stanley', 'Stanley']) {
      ids[name] = (
        (
          await owner
            .post(`/api/tables/${suppliers.id}/records`)
            .send({ data: { [supplierName.id]: name } })
            .expect(201)
        ).body as { id: string }
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
    const others = await addColumn(owner, products.id, {
      name: 'Otros proveedores',
      type: 'relation',
      options: { tableId: suppliers.id, multiple: true },
    });
    const base = `/api/tables/${products.id}`;
    return { owner, suppliers, ids, products, product, supplier, others, base };
  }

  it('links each row to the records it names, one or several', async () => {
    const s = await setup();
    const body = {
      columns: [s.product.id, s.supplier.id, s.others.id],
      rows: [
        // Names ignore case and surrounding spaces, as the export writes them.
        ['Taladro', ' bosch ', 'Makita, BOSCH'],
        ['Lijadora', 'Makita', ''],
        ['Brocas', '', 'Makita,Makita'],
      ],
    };
    const check = (
      await s.owner.post(`${s.base}/import/check`).send(body).expect(200)
    ).body as ImportCheck;
    expect(check).toMatchObject({ validRows: 3, errorCount: 0 });

    await s.owner.post(`${s.base}/import`).send(body).expect(201);
    const page = (
      await s.owner
        .get(`${s.base}/records`)
        .query({ sort: s.product.id })
        .expect(200)
    ).body as RecordPage;
    expect(
      page.data.map(({ data }) => [
        data[s.product.id],
        data[s.supplier.id] ?? null,
        data[s.others.id] ?? null,
      ]),
    ).toEqual([
      // A name repeated in one cell links once.
      ['Brocas', null, [s.ids['Makita']]],
      ['Lijadora', s.ids['Makita'], null],
      ['Taladro', s.ids['Bosch'], [s.ids['Makita'], s.ids['Bosch']]],
    ]);

    // What the export writes imports back as the same links.
    const csv = await s.owner.get(`${s.base}/records/export`).expect(200);
    expect(csv.text).toContain('Taladro;Bosch;Makita, Bosch');

    // And so does an Excel workbook, with the same labels.
    const xlsx = await s.owner
      .get(`${s.base}/records/export`)
      .query({ format: 'xlsx', sort: s.product.id })
      .buffer(true)
      .parse((response, done) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
    expect(xlsx.headers['content-disposition']).toMatch(/productos-.*\.xlsx/);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(xlsx.body as Buffer).buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.name).toBe('Productos');
    expect(sheet.getRow(4).values).toEqual([
      undefined,
      'Taladro',
      'Bosch',
      'Makita, Bosch',
    ]);
  });

  it('reports names no record has, or several do, and imports nothing', async () => {
    const s = await setup();
    const body = {
      columns: [s.product.id, s.supplier.id, s.others.id],
      rows: [
        ['Taladro', 'Dewalt', ''],
        ['Lijadora', 'Stanley', ''],
        ['Brocas', 'Bosch', 'Makita, Dewalt'],
      ],
    };
    const check = (
      await s.owner.post(`${s.base}/import/check`).send(body).expect(200)
    ).body as ImportCheck;
    expect(check.validRows).toBe(0);
    expect(check.errors).toEqual([
      { row: 1, column: 1, value: 'Dewalt', reason: 'unknownRecord' },
      // Two suppliers are called Stanley: which one is meant can't be told.
      { row: 2, column: 1, value: 'Stanley', reason: 'ambiguousRecord' },
      {
        row: 3,
        column: 2,
        value: 'Makita, Dewalt',
        reason: 'unknownRecord',
      },
    ]);
    await s.owner.post(`${s.base}/import`).send(body).expect(422);
  });

  it('links only to a table the importer can open', async () => {
    const s = await setup();
    const editor = await createSignedInClient(app);
    const editorUser = (await editor.get('/api/auth/me').expect(200))
      .body as AuthUser;
    await app.get(PrismaService).tableShare.create({
      data: { tableId: s.products.id, userId: editorUser.id, role: 'EDITOR' },
    });
    const body = {
      columns: [s.product.id, s.supplier.id],
      rows: [['Taladro', 'Bosch']],
    };
    // Matching names would tell what Proveedores holds.
    await editor.post(`${s.base}/import/check`).send(body).expect(403);
    await editor.post(`${s.base}/import`).send(body).expect(403);
    // Without the relation, the rest still imports.
    await editor
      .post(`${s.base}/import`)
      .send({ columns: [s.product.id, null], rows: [['Taladro', 'Bosch']] })
      .expect(201);
  });
});
