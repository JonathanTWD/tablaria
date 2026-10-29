import { INestApplication } from '@nestjs/common';
import type {
  ApiErrorBody,
  ImportCheck,
  ImportResult,
  RecordPage,
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

describe('Unique columns (e2e)', () => {
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

  async function addRecord(
    client: TestClient,
    base: string,
    data: object,
    status = 201,
  ) {
    return (await client.post(`${base}/records`).send({ data }).expect(status))
      .body as TableRecord & ApiErrorBody;
  }

  /** An inventory with a unique SKU and a stock count. */
  async function setup() {
    const owner = await createSignedInClient(app);
    const table = (
      await owner.post('/api/tables').send({ name: 'Almacén' }).expect(201)
    ).body as TableDetail;
    const base = `/api/tables/${table.id}`;
    const sku = await addColumn(owner, base, {
      name: 'SKU',
      type: 'text',
      unique: true,
    });
    const stock = await addColumn(owner, base, {
      name: 'Stock',
      type: 'number',
    });
    return { owner, base, sku, stock };
  }

  it('refuses a value another record holds, ignoring case and spaces', async () => {
    const { owner, base, sku, stock } = await setup();
    const first = await addRecord(owner, base, {
      [sku.id]: 'A-1',
      [stock.id]: 5,
    });
    const other = await addRecord(owner, base, { [sku.id]: 'B-2' });

    const refused = await addRecord(owner, base, { [sku.id]: ' a-1 ' }, 409);
    // Text is stored trimmed, so the message names it as it would be stored.
    expect(refused.details).toEqual([{ path: sku.id, message: 'a-1' }]);
    await owner
      .patch(`${base}/records/${other.id}`)
      .send({ data: { [sku.id]: 'A-1' } })
      .expect(409);
    // A record may keep its own value, and empty cells never clash.
    await owner
      .patch(`${base}/records/${first.id}`)
      .send({ data: { [sku.id]: 'A-1', [stock.id]: 6 } })
      .expect(200);
    await addRecord(owner, base, { [stock.id]: 1 });
    await addRecord(owner, base, { [stock.id]: 2 });
    // Accents and ñ ignore case too.
    await addRecord(owner, base, { [sku.id]: 'ÑANDÚ' });
    await addRecord(owner, base, { [sku.id]: 'ñandú' }, 409);
  });

  it('becomes unique only when no values repeat, and only for text and numbers', async () => {
    const { owner, base, stock } = await setup();
    await addRecord(owner, base, { [stock.id]: 5 });
    await addRecord(owner, base, { [stock.id]: 5 });

    const refused = await owner
      .patch(`${base}/columns/${stock.id}`)
      .send({ unique: true })
      .expect(409);
    expect((refused.body as ApiErrorBody).details).toEqual([
      { path: stock.id, message: '5' },
    ]);
    await owner
      .post(`${base}/columns`)
      .send({ name: 'Activo', type: 'boolean', unique: true })
      .expect(400);
    // Every record without the cell would share a default.
    await owner
      .post(`${base}/columns`)
      .send({ name: 'Lote', type: 'text', unique: true, defaultValue: 'L-1' })
      .expect(400);
  });

  it('compares numbers by value, however PostgreSQL writes them', async () => {
    const { owner, base } = await setup();
    const serial = await addColumn(owner, base, {
      name: 'Serie',
      type: 'number',
      unique: true,
    });
    await addRecord(owner, base, { [serial.id]: 1e-7 });
    await addRecord(owner, base, { [serial.id]: 1e-7 }, 409);
    await addRecord(owner, base, { [serial.id]: 1e21 });

    const check = (
      await owner
        .post(`${base}/import/check`)
        .send({
          columns: [serial.id],
          rows: [['1000000000000000000000']],
          updateBy: 0,
        })
        .expect(200)
    ).body as ImportCheck;
    expect(check).toMatchObject({ toUpdate: 1, errorCount: 0 });
  });

  it('imports by updating the records whose key the file repeats', async () => {
    const { owner, base, sku, stock } = await setup();
    const existing = await addRecord(owner, base, {
      [sku.id]: 'A-1',
      [stock.id]: 5,
    });
    const emptied = await addRecord(owner, base, {
      [sku.id]: 'B-2',
      [stock.id]: 3,
    });
    const body = {
      columns: [sku.id, stock.id],
      rows: [
        ['a-1', '12'],
        ['C-3', '7'],
        ['B-2', ''],
      ],
      updateBy: 0,
    };

    const check = (
      await owner.post(`${base}/import/check`).send(body).expect(200)
    ).body as ImportCheck;
    expect(check).toMatchObject({ validRows: 3, toUpdate: 2, errorCount: 0 });
    const result = (await owner.post(`${base}/import`).send(body).expect(201))
      .body as ImportResult;
    expect(result).toMatchObject({ imported: 1, updated: 2 });

    const page = (await owner.get(`${base}/records`).expect(200))
      .body as RecordPage;
    expect(page.meta.total).toBe(3);
    const updated = page.data.find(({ id }) => id === existing.id);
    // The stored key keeps its spelling; the stock is the file's.
    expect(updated?.data).toEqual({ [sku.id]: 'A-1', [stock.id]: 12 });
    // An empty cell of the file empties the record's.
    expect(page.data.find(({ id }) => id === emptied.id)?.data).toEqual({
      [sku.id]: 'B-2',
    });
  });

  it('reports repeated keys, in the file or against the table, without updates', async () => {
    const { owner, base, sku, stock } = await setup();
    await addRecord(owner, base, { [sku.id]: 'A-1' });
    const body = {
      columns: [sku.id, stock.id],
      rows: [
        ['A-1', '1'],
        ['B-2', '2'],
        ['b-2', '3'],
      ],
    };

    const check = (
      await owner.post(`${base}/import/check`).send(body).expect(200)
    ).body as ImportCheck;
    expect(check.errors).toEqual([
      { row: 1, column: 0, value: 'A-1', reason: 'duplicate' },
      { row: 3, column: 0, value: 'b-2', reason: 'duplicate' },
    ]);
    await owner.post(`${base}/import`).send(body).expect(422);
    // Updating needs a key that is unique.
    await owner
      .post(`${base}/import/check`)
      .send({ ...body, updateBy: 1 })
      .expect(400);
  });
});
