import { INestApplication } from '@nestjs/common';
import type { RecordStats, TableDetail } from '@wisedata/shared';
import { App } from 'supertest/types';
import {
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

describe('Record stats (e2e)', () => {
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

  async function createCatalog(client: TestClient) {
    const response = await client
      .post('/api/tables')
      .send({ name: 'Catálogo', templateId: 'product-catalog' })
      .expect(201);
    const table = response.body as TableDetail;
    const id = (columnName: string) =>
      table.columns.find(({ name }) => name === columnName)?.id ?? '';
    const add = (product: string, cells: Record<string, unknown>) =>
      client
        .post(`/api/tables/${table.id}/records`)
        .send({
          data: Object.fromEntries(
            Object.entries({ Producto: product, ...cells }).map(
              ([name, value]): [string, unknown] => [id(name), value],
            ),
          ),
        })
        .expect(201);
    const stats = async (query: Record<string, string>, status = 200) =>
      (
        await client
          .get(`/api/tables/${table.id}/records/stats`)
          .query(query)
          .expect(status)
      ).body as RecordStats;
    return { table, id, add, stats };
  }

  it('counts and sums records by a column, the largest groups first', async () => {
    const client = await createSignedInClient(app);
    const { id, add, stats } = await createCatalog(client);
    await add('Taladro', { Precio: 90, Estado: 'Disponible' });
    await add('Sierra', { Precio: 70, Estado: 'Agotado' });
    await add('Lijadora', { Precio: 45.5, Estado: 'Agotado' });
    await add('Nivel', { Estado: 'Agotado' });

    expect(await stats({ groupBy: id('Estado') })).toEqual({
      total: 4,
      groups: [
        { value: 'Agotado', count: 3, sum: null },
        { value: 'Disponible', count: 1, sum: null },
      ],
      others: null,
    });

    const byPrice = await stats({ groupBy: id('Estado'), sum: id('Precio') });
    expect(byPrice.groups).toEqual([
      { value: 'Agotado', count: 3, sum: 115.5 },
      { value: 'Disponible', count: 1, sum: 90 },
    ]);
  });

  it('groups empty cells and booleans', async () => {
    const client = await createSignedInClient(app);
    const { id, add, stats } = await createCatalog(client);
    await add('Taladro', { Categoría: 'Eléctricas', Destacado: true });
    await add('Martillo', {});

    expect((await stats({ groupBy: id('Categoría') })).groups).toEqual([
      { value: 'Eléctricas', count: 1, sum: null },
      { value: null, count: 1, sum: null },
    ]);
    expect((await stats({ groupBy: id('Destacado') })).groups).toEqual([
      { value: false, count: 1, sum: null },
      { value: true, count: 1, sum: null },
    ]);
  });

  it('only accepts columns of the table that can group or add up', async () => {
    const client = await createSignedInClient(app);
    const { id, stats } = await createCatalog(client);
    const other = await createCatalog(client);

    await stats({ groupBy: id('Precio') }, 400);
    await stats({ groupBy: id('Estado'), sum: id('Producto') }, 400);
    await stats({ groupBy: other.id('Estado') }, 400);
    await stats({ groupBy: 'not-a-uuid' }, 400);
  });

  it("answers 404 for another user's table", async () => {
    const owner = await createSignedInClient(app);
    const { table, id } = await createCatalog(owner);

    const intruder = await createSignedInClient(app);
    await intruder
      .get(`/api/tables/${table.id}/records/stats`)
      .query({ groupBy: id('Estado') })
      .expect(404);
  });
});
