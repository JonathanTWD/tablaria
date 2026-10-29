import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AuthUser,
  ImportCheck,
  ImportResult,
  OrganizationSummary,
  Paginated,
  TableColumn,
  TableDetail,
  TableRecord,
} from '@wisedata/shared';
import { App } from 'supertest/types';
import {
  createClient,
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';
import { extractToken, latestEmail } from './helpers/mailpit';

describe('Importing rows (e2e)', () => {
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

  async function addColumn(client: TestClient, base: string, body: object) {
    return (await client.post(`${base}/columns`).send(body).expect(201))
      .body as TableColumn;
  }

  async function setup() {
    const owner = await createSignedInClient(app);
    const table = (
      await owner.post('/api/tables').send({ name: 'Almacén' }).expect(201)
    ).body as TableDetail;
    const base = `/api/tables/${table.id}`;
    const product = await addColumn(owner, base, {
      name: 'Producto',
      type: 'text',
      required: true,
    });
    const stock = await addColumn(owner, base, {
      name: 'Stock',
      type: 'number',
    });
    const checked = await addColumn(owner, base, {
      name: 'Revisión',
      type: 'date',
    });
    const status = await addColumn(owner, base, {
      name: 'Estado',
      type: 'select',
      options: {
        choices: [{ id: 'disponible', label: 'Disponible', color: 'green' }],
      },
    });
    return { owner, table, base, product, stock, checked, status };
  }

  /** The file's columns: product, stock, date, status (and one skipped). */
  function columnsOf(context: Awaited<ReturnType<typeof setup>>) {
    return [
      context.product.id,
      context.stock.id,
      null,
      context.checked.id,
      context.status.id,
    ];
  }

  /** A second account with editor access to the table, by invitation. */
  async function addEditor(owner: TestClient, base: string) {
    const editor = await createSignedInClient(app);
    const editorUser = (await editor.get('/api/auth/me').expect(200))
      .body as AuthUser;
    await owner
      .post(`${base}/invitations`)
      .send({ email: editorUser.email, role: 'EDITOR' })
      .expect(201);
    const token = extractToken(await latestEmail(editorUser.email));
    await editor.post('/api/invitations/accept').send({ token }).expect(200);
    return editor;
  }

  async function records(client: TestClient, base: string) {
    return (await client.get(`${base}/records`).expect(200))
      .body as Paginated<TableRecord>;
  }

  it('checks a file without writing, then imports it whole', async () => {
    const context = await setup();
    const { owner, base, product, stock, checked, status } = context;
    const body = {
      columns: columnsOf(context),
      rows: [
        ['Taladro', '1.234,5', 'ignorada', '01/10/2026', 'disponible'],
        ['Sierra', '', 'ignorada', '', ''],
      ],
    };

    const check = (
      await owner.post(`${base}/import/check`).send(body).expect(200)
    ).body as ImportCheck;
    expect(check).toEqual({
      rows: 2,
      validRows: 2,
      errorCount: 0,
      errors: [],
      missingChoices: [],
      missingRequired: [],
      toUpdate: 0,
    });
    expect((await records(owner, base)).meta.total).toBe(0);

    const result = (await owner.post(`${base}/import`).send(body).expect(201))
      .body as ImportResult;
    expect(result).toEqual({
      tableId: context.table.id,
      imported: 2,
      updated: 0,
      addedChoices: 0,
      addedColumns: 0,
    });
    const data = (await records(owner, base)).data.map((record) => record.data);
    expect(data).toEqual(
      expect.arrayContaining([
        {
          [product.id]: 'Taladro',
          [stock.id]: 1234.5,
          [checked.id]: '2026-10-01',
          [status.id]: 'Disponible',
        },
        { [product.id]: 'Sierra' },
      ]),
    );
  });

  it('reports every invalid cell and imports nothing while any remains', async () => {
    const context = await setup();
    const { owner, base } = context;
    const body = {
      columns: columnsOf(context),
      rows: [
        ['Taladro', '12 uds', '', '31/02/2026', 'Agotado'],
        ['', '3', '', '', ''],
        ['Sierra', '4', '', '', ''],
      ],
    };

    const check = (
      await owner.post(`${base}/import/check`).send(body).expect(200)
    ).body as ImportCheck;
    expect(check.validRows).toBe(1);
    expect(check.errors).toEqual([
      // Columns by their position in the file.
      { row: 1, column: 1, value: '12 uds', reason: 'invalid' },
      { row: 1, column: 3, value: '31/02/2026', reason: 'invalid' },
      { row: 1, column: 4, value: 'Agotado', reason: 'unknownChoice' },
      { row: 2, column: 0, value: '', reason: 'required' },
    ]);
    expect(check.missingChoices).toEqual([{ column: 4, values: ['Agotado'] }]);

    await owner.post(`${base}/import`).send(body).expect(422);
    expect((await records(owner, base)).meta.total).toBe(0);
  });

  it('adds missing choices only for those who manage the table', async () => {
    const context = await setup();
    const { owner, base, status } = context;
    const editor = await addEditor(owner, base);

    const body = {
      columns: columnsOf(context),
      rows: [['Taladro', '1', '', '', 'Agotado']],
      addMissingChoices: true,
    };
    // Editors import rows, but new choices change the column.
    await editor.post(`${base}/import`).send(body).expect(403);
    await editor
      .post(`${base}/import`)
      .send({ ...body, rows: [['Taladro', '1', '', '', 'Disponible']] })
      .expect(201);

    const result = (await owner.post(`${base}/import`).send(body).expect(201))
      .body as ImportResult;
    expect(result).toMatchObject({ imported: 1, addedChoices: 1 });
    const columns = (await owner.get(`${base}/columns`).expect(200))
      .body as TableColumn[];
    const updated = columns.find(({ id }) => id === status.id);
    expect(
      updated?.type === 'select' &&
        updated.options.choices.map(({ label }) => label),
    ).toEqual(['Disponible', 'Agotado']);
  });

  it('keeps imports to people who may edit the table', async () => {
    const context = await setup();
    const { base, table } = context;
    const stranger = await createSignedInClient(app);
    const body = { columns: columnsOf(context), rows: [['Taladro']] };

    await stranger.post(`${base}/import/check`).send(body).expect(404);
    await stranger.post(`${base}/import`).send(body).expect(404);

    // Column ids from another table are refused.
    const other = await setup();
    await context.owner
      .post(`/api/tables/${table.id}/import`)
      .send({ columns: [other.product.id], rows: [['Taladro']] })
      .expect(400);
    await context.owner
      .post(`${base}/import`)
      .send({ columns: [null], rows: [['Taladro']] })
      .expect(400);
  });

  it('accepts a large file on import, while other routes keep the small limit', async () => {
    const { owner, base, product } = await setup();
    const rows = Array.from({ length: 3000 }, (_, index) => [
      `Producto con un nombre largo para ocupar espacio ${index}`,
    ]);

    const result = (
      await owner
        .post(`${base}/import`)
        .send({ columns: [product.id], rows })
        .expect(201)
    ).body as ImportResult;
    expect(result.imported).toBe(3000);

    await owner
      .post(`${base}/records`)
      .send({ data: { [product.id]: 'x'.repeat(200_000) } })
      .expect(413);
  });

  it('creates columns from the file, for admins only', async () => {
    const context = await setup();
    const { owner, base, product } = context;
    const editor = await addEditor(owner, base);
    const body = {
      columns: [
        product.id,
        { create: { name: 'Proveedor', type: 'text' } },
        {
          create: {
            name: 'Precio',
            type: 'currency',
            options: { currency: 'EUR' },
          },
        },
      ],
      rows: [['Taladro', 'Bosch', '89,90']],
    };

    await editor.post(`${base}/import/check`).send(body).expect(403);
    await editor.post(`${base}/import`).send(body).expect(403);
    // A new column can't take the name of one the table has.
    await owner
      .post(`${base}/import/check`)
      .send({
        ...body,
        columns: [product.id, { create: { name: 'stock', type: 'number' } }],
      })
      .expect(409);

    const result = (await owner.post(`${base}/import`).send(body).expect(201))
      .body as ImportResult;
    expect(result).toMatchObject({ imported: 1, addedColumns: 2 });
    const columns = (await owner.get(`${base}/columns`).expect(200))
      .body as TableColumn[];
    expect(columns.map(({ name, position }) => [name, position])).toEqual([
      ['Producto', 0],
      ['Stock', 1],
      ['Revisión', 2],
      ['Estado', 3],
      ['Proveedor', 4],
      ['Precio', 5],
    ]);
    const [record] = (await records(owner, base)).data;
    expect(Object.values(record.data)).toEqual(
      expect.arrayContaining(['Taladro', 'Bosch', 89.9]),
    );
  });

  it('says once which required columns the file leaves empty', async () => {
    const context = await setup();
    const { owner, base, stock } = context;
    const body = { columns: [stock.id], rows: [['3'], ['4']] };

    const check = (
      await owner.post(`${base}/import/check`).send(body).expect(200)
    ).body as ImportCheck;
    expect(check).toMatchObject({
      validRows: 0,
      errorCount: 0,
      missingRequired: [context.product.id],
    });
    await owner.post(`${base}/import`).send(body).expect(422);
  });

  it('creates a whole table from a file, in a space the user administers', async () => {
    const owner = await createSignedInClient(app);
    const [personal] = (await owner.get('/api/organizations').expect(200))
      .body as OrganizationSummary[];
    const url = `/api/organizations/${personal.id}/tables/import`;
    const body = {
      name: 'Inventario de Excel',
      columns: [
        { create: { name: 'Producto', type: 'text', required: true } },
        null,
        {
          create: {
            name: 'Estado',
            type: 'select',
            options: {
              choices: [{ id: 'a', label: 'Disponible', color: 'green' }],
            },
          },
        },
      ],
      rows: [
        ['Taladro', 'ignorada', 'Disponible'],
        ['Sierra', 'ignorada', 'Agotado'],
      ],
      addMissingChoices: true,
    };

    const check = (await owner.post(`${url}/check`).send(body).expect(200))
      .body as ImportCheck;
    expect(check).toMatchObject({ validRows: 2, errorCount: 0 });
    // A new table has no columns to reuse.
    await owner
      .post(url)
      .send({ ...body, columns: [randomUUID()] })
      .expect(400);

    const result = (await owner.post(url).send(body).expect(201))
      .body as ImportResult;
    expect(result).toMatchObject({ imported: 2, addedColumns: 2 });
    const table = (await owner.get(`/api/tables/${result.tableId}`).expect(200))
      .body as TableDetail;
    expect(table).toMatchObject({
      name: 'Inventario de Excel',
      recordCount: 2,
      organizationId: personal.id,
    });
    const status = table.columns.find(({ name }) => name === 'Estado');
    expect(
      status?.type === 'select' &&
        status.options.choices.map(({ label }) => label),
    ).toEqual(['Disponible', 'Agotado']);

    // Nobody else creates tables in this space.
    const stranger = await createSignedInClient(app);
    await stranger.post(url).send(body).expect(404);
  });

  it("keeps the file's order in the table", async () => {
    const { owner, base, product } = await setup();
    const names = Array.from(
      { length: 30 },
      (_, index) => `Producto ${index + 1}`,
    );

    await owner
      .post(`${base}/import`)
      .send({ columns: [product.id], rows: names.map((name) => [name]) })
      .expect(201);

    const page = (await owner.get(`${base}/records?pageSize=30`).expect(200))
      .body as Paginated<TableRecord>;
    expect(page.data.map((record) => record.data[product.id])).toEqual(names);
  });

  it('keeps the large body limit to signed-in people', async () => {
    const { base, product } = await setup();
    const rows = Array.from({ length: 3000 }, (_, index) => [
      `Producto con un nombre largo para ocupar espacio ${index}`,
    ]);

    // Without a session the body is refused for its size, before any parsing of 2 MB.
    await createClient(app)
      .post(`${base}/import`)
      .send({ columns: [product.id], rows })
      .expect(413);
  });
});
