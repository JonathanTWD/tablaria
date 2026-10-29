import { INestApplication } from '@nestjs/common';
import type {
  AuthUser,
  ImportCheck,
  ImportResult,
  Paginated,
  TableColumn,
  TableDetail,
  TableRecord,
} from '@wisedata/shared';
import { App } from 'supertest/types';
import {
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
    });
    expect((await records(owner, base)).meta.total).toBe(0);

    const result = (await owner.post(`${base}/import`).send(body).expect(201))
      .body as ImportResult;
    expect(result).toEqual({ imported: 2, addedChoices: 0 });
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
    const { owner, base, product, stock, checked, status } = context;
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
      { row: 1, columnId: stock.id, value: '12 uds', reason: 'invalid' },
      { row: 1, columnId: checked.id, value: '31/02/2026', reason: 'invalid' },
      {
        row: 1,
        columnId: status.id,
        value: 'Agotado',
        reason: 'unknownChoice',
      },
      { row: 2, columnId: product.id, value: '', reason: 'required' },
    ]);
    expect(check.missingChoices).toEqual([
      { columnId: status.id, values: ['Agotado'] },
    ]);

    await owner.post(`${base}/import`).send(body).expect(422);
    expect((await records(owner, base)).meta.total).toBe(0);
  });

  it('adds missing choices only for those who manage the table', async () => {
    const context = await setup();
    const { owner, base, status } = context;
    const editor = await createSignedInClient(app);
    const editorUser = (await editor.get('/api/auth/me').expect(200))
      .body as AuthUser;
    await owner
      .post(`${base}/invitations`)
      .send({ email: editorUser.email, role: 'EDITOR' })
      .expect(201);
    const token = extractToken(await latestEmail(editorUser.email));
    await editor.post('/api/invitations/accept').send({ token }).expect(200);

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
    expect(result).toEqual({ imported: 1, addedChoices: 1 });
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
});
