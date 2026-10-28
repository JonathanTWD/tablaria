import { INestApplication } from '@nestjs/common';
import {
  type ApiErrorBody,
  MAX_RECORDS_PER_TABLE,
  type Paginated,
  type TableDetail,
  type TableRecord,
  type TableSummary,
} from '@wisedata/shared';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import {
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

describe('Records (e2e)', () => {
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

  /** A "Productos" table: Nombre (required), Stock (default 0), Precio, Alta, Estado, Activo. */
  async function createProducts(client: TestClient) {
    const response = await client
      .post('/api/tables')
      .send({ name: 'Productos' })
      .expect(201);
    const table = response.body as TableDetail;
    const add = async (body: object) => {
      const column = await client
        .post(`/api/tables/${table.id}/columns`)
        .send(body)
        .expect(201);
      return (column.body as { id: string }).id;
    };
    const ids = {
      name: await add({ name: 'Nombre', type: 'text', required: true }),
      stock: await add({ name: 'Stock', type: 'number', defaultValue: 0 }),
      price: await add({
        name: 'Precio',
        type: 'currency',
        options: { currency: 'EUR' },
      }),
      since: await add({ name: 'Alta', type: 'date' }),
      status: await add({
        name: 'Estado',
        type: 'select',
        options: {
          choices: [
            { id: 'ok', label: 'Disponible', color: 'green' },
            { id: 'out', label: 'Agotado', color: 'red' },
          ],
        },
      }),
      active: await add({ name: 'Activo', type: 'boolean' }),
    };
    const url = `/api/tables/${table.id}/records`;
    return { table, ids, url };
  }

  async function createRecord(
    client: TestClient,
    url: string,
    data: object,
  ): Promise<TableRecord> {
    const response = await client.post(url).send({ data }).expect(201);
    return response.body as TableRecord;
  }

  async function list(client: TestClient, url: string, query: object = {}) {
    const response = await client.get(url).query(query).expect(200);
    return response.body as Paginated<TableRecord>;
  }

  describe('writing records', () => {
    it('creates a record with defaults and empty cells left out', async () => {
      const client = await createSignedInClient(app);
      const { ids, url } = await createProducts(client);

      const record = await createRecord(client, url, {
        [ids.name]: '  Taladro ',
        [ids.price]: 49.9,
        [ids.since]: '',
      });

      expect(record.data).toEqual({
        [ids.name]: 'Taladro',
        [ids.stock]: 0,
        [ids.price]: 49.9,
      });
    });

    it('validates values against the columns', async () => {
      const client = await createSignedInClient(app);
      const { ids, url } = await createProducts(client);
      const detailsOf = async (data: object) => {
        const response = await client.post(url).send({ data }).expect(400);
        return (response.body as ApiErrorBody).details?.map(({ path }) => path);
      };

      expect(await detailsOf({ [ids.stock]: 3 })).toEqual([ids.name]);
      expect(await detailsOf({ [ids.name]: 'A', [ids.stock]: 'tres' })).toEqual(
        [ids.stock],
      );
      expect(
        await detailsOf({ [ids.name]: 'A', [ids.since]: '2026-02-30' }),
      ).toEqual([ids.since]);
      expect(
        await detailsOf({ [ids.name]: 'A', [ids.status]: 'Perdido' }),
      ).toEqual([ids.status]);
      expect(await detailsOf({ [ids.name]: 'A', [randomUUID()]: 'x' })).toEqual(
        [''],
      );
    });

    it('updates only the cells it sends and empties cells set to null', async () => {
      const client = await createSignedInClient(app);
      const { ids, url } = await createProducts(client);
      const record = await createRecord(client, url, {
        [ids.name]: 'Taladro',
        [ids.price]: 49.9,
      });

      const response = await client
        .patch(`${url}/${record.id}`)
        .send({ data: { [ids.stock]: 12, [ids.price]: null } })
        .expect(200);
      expect((response.body as TableRecord).data).toEqual({
        [ids.name]: 'Taladro',
        [ids.stock]: 12,
      });

      await client
        .patch(`${url}/${record.id}`)
        .send({ data: { [ids.name]: null } })
        .expect(400);
    });

    it('deletes a record', async () => {
      const client = await createSignedInClient(app);
      const { ids, url } = await createProducts(client);
      const record = await createRecord(client, url, { [ids.name]: 'Taladro' });

      await client.delete(`${url}/${record.id}`).expect(204);
      await client.delete(`${url}/${record.id}`).expect(404);
      expect((await list(client, url)).meta.total).toBe(0);
    });

    it('counts writing a record as editing the table', async () => {
      const client = await createSignedInClient(app);
      const first = await createProducts(client);
      const second = await createProducts(client);

      await createRecord(client, first.url, { [first.ids.name]: 'Taladro' });

      const response = await client.get('/api/tables').expect(200);
      const tables = response.body as TableSummary[];
      expect(tables.map(({ id }) => id)).toEqual([
        first.table.id,
        second.table.id,
      ]);
      expect(tables[0].recordCount).toBe(1);
    });

    it('limits how many records a table can have', async () => {
      const client = await createSignedInClient(app);
      const { table, ids, url } = await createProducts(client);
      await app.get(PrismaService).record.createMany({
        data: Array.from({ length: MAX_RECORDS_PER_TABLE }, () => ({
          tableId: table.id,
        })),
      });

      await client
        .post(url)
        .send({ data: { [ids.name]: 'Uno más' } })
        .expect(422);
    });
  });

  describe('listing records', () => {
    async function seed() {
      const client = await createSignedInClient(app);
      const products = await createProducts(client);
      const { ids, url } = products;
      const rows = [
        {
          [ids.name]: 'Taladro',
          [ids.stock]: 4,
          [ids.price]: 89.9,
          [ids.since]: '2026-01-10',
          [ids.status]: 'Disponible',
          [ids.active]: true,
        },
        {
          [ids.name]: 'Martillo 50% dto',
          [ids.stock]: 30,
          [ids.price]: 12.5,
          [ids.since]: '2026-03-02',
          [ids.status]: 'Disponible',
          [ids.active]: false,
        },
        {
          [ids.name]: 'Sierra',
          [ids.stock]: 0,
          [ids.since]: '2025-11-20',
          [ids.status]: 'Agotado',
        },
        {
          [ids.name]: 'alicates',
          [ids.stock]: 9,
          [ids.price]: 7,
          [ids.active]: true,
        },
      ];
      for (const data of rows) {
        await createRecord(client, url, data);
      }
      return { client, ...products };
    }

    const names = (page: Paginated<TableRecord>, nameId: string) =>
      page.data.map((record) => record.data[nameId]);

    it('paginates in creation order', async () => {
      const { client, ids, url } = await seed();

      const page = await list(client, url, { page: 2, pageSize: 3 });

      expect(page.meta).toEqual({
        page: 2,
        pageSize: 3,
        total: 4,
        pageCount: 2,
      });
      expect(names(page, ids.name)).toEqual(['alicates']);
    });

    it('searches text and select cells, treating wildcards literally', async () => {
      const { client, ids, url } = await seed();

      expect(
        names(await list(client, url, { search: 'agot' }), ids.name),
      ).toEqual(['Sierra']);
      expect(
        names(await list(client, url, { search: '50%' }), ids.name),
      ).toEqual(['Martillo 50% dto']);
      expect((await list(client, url, { search: '_' })).meta.total).toBe(0);
    });

    it('sorts by typed values with empty cells last', async () => {
      const { client, ids, url } = await seed();

      const byStock = await list(client, url, {
        sort: ids.stock,
        order: 'desc',
      });
      expect(names(byStock, ids.name)).toEqual([
        'Martillo 50% dto',
        'alicates',
        'Taladro',
        'Sierra',
      ]);

      const byPrice = await list(client, url, { sort: ids.price });
      expect(names(byPrice, ids.name)).toEqual([
        'alicates',
        'Martillo 50% dto',
        'Taladro',
        'Sierra',
      ]);

      const byName = await list(client, url, { sort: ids.name });
      expect(names(byName, ids.name)).toEqual([
        'alicates',
        'Martillo 50% dto',
        'Sierra',
        'Taladro',
      ]);
    });

    it('filters by the operator of each column type', async () => {
      const { client, ids, url } = await seed();
      const filter = async (filters: object[]) =>
        names(
          await list(client, url, { filters: JSON.stringify(filters) }),
          ids.name,
        );

      expect(
        await filter([{ columnId: ids.stock, op: 'between', min: 1, max: 10 }]),
      ).toEqual(['Taladro', 'alicates']);
      expect(
        await filter([
          { columnId: ids.since, op: 'between', min: '2026-01-01' },
        ]),
      ).toEqual(['Taladro', 'Martillo 50% dto']);
      expect(
        await filter([{ columnId: ids.status, op: 'in', values: ['Agotado'] }]),
      ).toEqual(['Sierra']);
      expect(
        await filter([{ columnId: ids.active, op: 'is', value: true }]),
      ).toEqual(['Taladro', 'alicates']);
      expect(
        await filter([
          { columnId: ids.name, op: 'contains', value: 'a' },
          { columnId: ids.price, op: 'between', max: 50 },
        ]),
      ).toEqual(['Martillo 50% dto', 'alicates']);
    });

    it('exports every matching record as CSV, in the order shown', async () => {
      const { client, ids, url } = await seed();
      const filters = JSON.stringify([
        { columnId: ids.status, op: 'in', values: ['Disponible'] },
      ]);

      const response = await client
        .get(`${url}/export`)
        .query({ format: 'csv', sort: ids.price, order: 'desc', filters })
        .buffer(true)
        .parse((res, done) => {
          let body = '';
          res.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
          res.on('end', () => done(null, body));
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toMatch(
        /^attachment; filename="productos-\d{4}-\d{2}-\d{2}\.csv"$/,
      );
      // Byte order mark, ";" and decimal commas: what Excel in Spanish opens directly.
      expect((response.body as string).split('\r\n')).toEqual([
        `${String.fromCharCode(0xfeff)}Nombre;Stock;Precio (EUR);Alta;Estado;Activo`,
        'Taladro;4;89,9;2026-01-10;Disponible;Sí',
        'Martillo 50% dto;30;12,5;2026-03-02;Disponible;No',
        '',
      ]);
    });

    it("doesn't export another user's table", async () => {
      const { url } = await seed();
      const other = await createSignedInClient(app);

      await other.get(`${url}/export`).expect(404);
    });

    it('rejects invalid queries', async () => {
      const { client, ids, url } = await seed();
      const bad = (query: object) => client.get(url).query(query).expect(400);

      await bad({ pageSize: 101 });
      await client.get(`${url}/export`).query({ format: 'pdf' }).expect(400);
      await bad({ sort: randomUUID() });
      await bad({ filters: 'not json' });
      await bad({
        filters: JSON.stringify([
          { columnId: randomUUID(), op: 'is', value: true },
        ]),
      });
      await bad({
        filters: JSON.stringify([
          { columnId: ids.stock, op: 'contains', value: '3' },
        ]),
      });
    });
  });

  it("never exposes or changes another user's records", async () => {
    const owner = await createSignedInClient(app);
    const other = await createSignedInClient(app);
    const { ids, url } = await createProducts(owner);
    const record = await createRecord(owner, url, { [ids.name]: 'Taladro' });

    await other.get(url).expect(404);
    await other
      .post(url)
      .send({ data: { [ids.name]: 'Intruso' } })
      .expect(404);
    await other
      .patch(`${url}/${record.id}`)
      .send({ data: { [ids.name]: 'Mío' } })
      .expect(404);
    await other.delete(`${url}/${record.id}`).expect(404);

    // A record id from another table is not reachable through the caller's own table.
    const own = await createProducts(other);
    await other
      .patch(`${own.url}/${record.id}`)
      .send({ data: { [own.ids.name]: 'Mío' } })
      .expect(404);

    const unchanged = await list(owner, url);
    expect(unchanged.data).toEqual([record]);
  });
});
