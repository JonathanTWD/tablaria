import { INestApplication } from '@nestjs/common';
import type { RecordPage, TableColumn, TableDetail } from '@tablaria/shared';
import { App } from 'supertest/types';
import {
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

describe('Grouping records (e2e)', () => {
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

  /** Products with a status list (Disponible, Agotado), a text and a stock. */
  async function setup() {
    const owner = await createSignedInClient(app);
    const table = (
      await owner.post('/api/tables').send({ name: 'Productos' }).expect(201)
    ).body as TableDetail;
    const base = `/api/tables/${table.id}`;
    const addColumn = async (body: object) =>
      (await owner.post(`${base}/columns`).send(body).expect(201))
        .body as TableColumn;
    const name = await addColumn({ name: 'Producto', type: 'text' });
    const status = await addColumn({
      name: 'Estado',
      type: 'select',
      options: {
        choices: [
          { id: 'disponible', label: 'Disponible', color: 'green' },
          { id: 'agotado', label: 'Agotado', color: 'red' },
        ],
      },
    });
    const stock = await addColumn({ name: 'Stock', type: 'number' });
    for (const [product, state, units] of [
      ['Taladro', 'Agotado', 0],
      ['Sierra', 'Disponible', 4],
      ['Martillo', null, 9],
      ['Cinta', 'Disponible', 12],
      ['Tornillos', 'Agotado', 0],
    ] as const) {
      await owner
        .post(`${base}/records`)
        .send({
          data: {
            [name.id]: product,
            [stock.id]: units,
            ...(state && { [status.id]: state }),
          },
        })
        .expect(201);
    }
    return { owner, base, name, status, stock };
  }

  async function list(client: TestClient, base: string, query: object) {
    return (await client.get(`${base}/records`).query(query).expect(200))
      .body as RecordPage;
  }

  it('lists records group by group, with the size of every group', async () => {
    const { owner, base, name, status, stock } = await setup();

    // Groups in the order of the choices, empty last; inside, by stock.
    const page = await list(owner, base, {
      group: status.id,
      sort: stock.id,
      order: 'desc',
      pageSize: 2,
    });
    expect(page.data.map(({ data }) => data[name.id])).toEqual([
      'Cinta',
      'Sierra',
    ]);
    expect(page.groups).toEqual(
      expect.arrayContaining([
        { value: 'Disponible', count: 2 },
        { value: 'Agotado', count: 2 },
        { value: null, count: 1 },
      ]),
    );
    expect(page.groups).toHaveLength(3);
    const last = await list(owner, base, {
      group: status.id,
      sort: stock.id,
      order: 'desc',
      pageSize: 2,
      page: 3,
    });
    expect(last.data.map(({ data }) => data[name.id])).toEqual(['Martillo']);

    // Counts follow the search; without a group there are none.
    const searched = await list(owner, base, {
      group: status.id,
      search: 'o',
    });
    expect(searched.groups).toEqual(
      expect.arrayContaining([
        { value: 'Agotado', count: 2 },
        { value: null, count: 1 },
      ]),
    );
    expect((await list(owner, base, {})).groups).toEqual([]);
  });

  it('groups only by lists, Yes/No, text and relations', async () => {
    const { owner, base, stock } = await setup();
    await owner.get(`${base}/records`).query({ group: stock.id }).expect(400);
  });
});
