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

describe('Rollup columns (e2e)', () => {
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

  /**
   * Teams and their employees: a salary, a start date, the team they are in
   * and, within the same table, their manager.
   */
  async function setup() {
    const owner = await createSignedInClient(app);
    const teams = await createTable(owner, 'Equipos');
    const teamName = await addColumn(owner, teams.id, {
      name: 'Nombre',
      type: 'text',
    });
    const teamIds: Record<string, string> = {};
    for (const name of ['Ventas', 'Almacén', 'Diseño']) {
      teamIds[name] = (
        await addRecord(owner, teams.id, { [teamName.id]: name })
      ).id;
    }

    const people = await createTable(owner, 'Empleados');
    const name = await addColumn(owner, people.id, {
      name: 'Nombre',
      type: 'text',
    });
    const salary = await addColumn(owner, people.id, {
      name: 'Salario',
      type: 'currency',
      options: { currency: 'EUR' },
    });
    const start = await addColumn(owner, people.id, {
      name: 'Alta',
      type: 'date',
    });
    const team = await addColumn(owner, people.id, {
      name: 'Equipo',
      type: 'relation',
      options: { tableId: teams.id },
    });
    const manager = await addColumn(owner, people.id, {
      name: 'Jefe',
      type: 'relation',
      options: { tableId: people.id },
    });
    const personIds: Record<string, string> = {};
    for (const [person, pay, date, in_, boss] of [
      ['Lucía', 2400, '2024-03-01', 'Ventas', null],
      ['Marco', 1800, '2025-06-15', 'Ventas', 'Lucía'],
      ['Sara', 2100, '2026-01-10', 'Almacén', 'Lucía'],
    ] as const) {
      personIds[person] = (
        await addRecord(owner, people.id, {
          [name.id]: person,
          [salary.id]: pay,
          [start.id]: date,
          [team.id]: teamIds[in_],
          ...(boss && { [manager.id]: personIds[boss] }),
        })
      ).id;
    }
    return {
      owner,
      teams,
      teamName,
      people,
      name,
      salary,
      start,
      team,
      manager,
    };
  }

  function rollup(
    client: TestClient,
    tableId: string,
    columnName: string,
    options: object,
  ) {
    return client
      .post(`/api/tables/${tableId}/columns`)
      .send({ name: columnName, type: 'rollup', options });
  }

  async function list(client: TestClient, tableId: string) {
    return (await client.get(`/api/tables/${tableId}/records`).expect(200))
      .body as RecordPage;
  }

  it('sums up, for each team, the employees that link to it', async () => {
    const s = await setup();
    const add = async (columnName: string, options: object) =>
      (await rollup(s.owner, s.teams.id, columnName, options).expect(201))
        .body as TableColumn;
    const count = await add('Personas', {
      relationColumnId: s.team.id,
      function: 'count',
    });
    const total = await add('Coste en salarios', {
      relationColumnId: s.team.id,
      function: 'sum',
      targetColumnId: s.salary.id,
    });
    const average = await add('Salario medio', {
      relationColumnId: s.team.id,
      function: 'avg',
      targetColumnId: s.salary.id,
    });
    const latest = await add('Última alta', {
      relationColumnId: s.team.id,
      function: 'max',
      targetColumnId: s.start.id,
    });

    const page = await list(s.owner, s.teams.id);
    expect(
      page.data.map(({ data }) => [
        data[s.teamName.id],
        data[count.id] ?? null,
        data[total.id] ?? null,
        data[average.id] ?? null,
        data[latest.id] ?? null,
      ]),
    ).toEqual([
      ['Ventas', 2, 4200, 2100, '2025-06-15'],
      ['Almacén', 1, 2100, 2100, '2026-01-10'],
      // Nobody links here: none counted and nothing added up.
      ['Diseño', 0, 0, null, null],
    ]);

    const detail = (await s.owner.get(`/api/tables/${s.teams.id}`).expect(200))
      .body as TableDetail;
    expect(detail.rollupTargets[count.id]).toBeNull();
    expect(detail.rollupTargets[total.id]).toMatchObject({ name: 'Salario' });
    expect(detail.incomingRelations).toEqual([
      {
        columnId: s.team.id,
        columnName: 'Equipo',
        tableId: s.people.id,
        tableName: 'Empleados',
      },
    ]);

    const csv = await s.owner
      .get(`/api/tables/${s.teams.id}/records/export`)
      .expect(200);
    expect(csv.text).toContain('Ventas;2;4200;2100;2025-06-15');

    // Never written.
    await s.owner
      .post(`/api/tables/${s.teams.id}/records`)
      .send({ data: { [count.id]: 3 } })
      .expect(400);
  });

  it('sorts and filters teams by what they sum up', async () => {
    const s = await setup();
    const add = async (columnName: string, options: object) =>
      (
        await rollup(s.owner, s.teams.id, columnName, {
          relationColumnId: s.team.id,
          ...options,
        }).expect(201)
      ).body as TableColumn;
    const count = await add('Personas', { function: 'count' });
    const total = await add('Coste', {
      function: 'sum',
      targetColumnId: s.salary.id,
    });
    const average = await add('Salario medio', {
      function: 'avg',
      targetColumnId: s.salary.id,
    });
    const latest = await add('Última alta', {
      function: 'max',
      targetColumnId: s.start.id,
    });

    const names = async (query: Record<string, string>) =>
      (
        (
          await s.owner
            .get(`/api/tables/${s.teams.id}/records`)
            .query(query)
            .expect(200)
        ).body as RecordPage
      ).data.map(({ data }) => data[s.teamName.id]);
    const filters = (...list: object[]) => JSON.stringify(list);

    expect(await names({ sort: count.id, order: 'desc' })).toEqual([
      'Ventas',
      'Almacén',
      'Diseño',
    ]);
    // Nobody links to Diseño: 0 people, so first going up.
    expect(await names({ sort: total.id })).toEqual([
      'Diseño',
      'Almacén',
      'Ventas',
    ]);
    // No average at all: last either way, ties in creation order.
    expect(await names({ sort: average.id, order: 'desc' })).toEqual([
      'Ventas',
      'Almacén',
      'Diseño',
    ]);
    expect(
      await names({
        filters: filters({ columnId: count.id, op: 'between', min: 1 }),
      }),
    ).toEqual(['Ventas', 'Almacén']);
    expect(
      await names({
        filters: filters({ columnId: total.id, op: 'between', max: 0 }),
      }),
    ).toEqual(['Diseño']);
    // Filtered and sorted by the same rollup, and by another one.
    expect(
      await names({
        filters: filters(
          { columnId: count.id, op: 'between', min: 1 },
          { columnId: latest.id, op: 'between', min: '2025-01-01' },
        ),
        sort: count.id,
      }),
    ).toEqual(['Almacén', 'Ventas']);
    // A rollup of dates takes dates.
    await s.owner
      .get(`/api/tables/${s.teams.id}/records`)
      .query({
        filters: filters({ columnId: latest.id, op: 'between', min: 5 }),
      })
      .expect(400);
    // Still not a group key: each record has its own value.
    await s.owner
      .get(`/api/tables/${s.teams.id}/records`)
      .query({ group: count.id })
      .expect(400);

    const csv = await s.owner
      .get(`/api/tables/${s.teams.id}/records/export`)
      .query({ sort: count.id, order: 'desc' })
      .expect(200);
    expect(
      csv.text
        .split('\r\n')
        .slice(1)
        .filter((line) => line !== '')
        .map((line) => line.split(';')[0]),
    ).toEqual(['Ventas', 'Almacén', 'Diseño']);
  });

  it('sums up within the same table, such as the people someone manages', async () => {
    const s = await setup();
    const reports = (
      await rollup(s.owner, s.people.id, 'Personas a su cargo', {
        relationColumnId: s.manager.id,
        function: 'count',
      }).expect(201)
    ).body as TableColumn;

    const page = await list(s.owner, s.people.id);
    expect(
      page.data.map(({ data }) => [data[s.name.id], data[reports.id]]),
    ).toEqual([
      ['Lucía', 2],
      ['Marco', 0],
      ['Sara', 0],
    ]);
    const detail = (await s.owner.get(`/api/tables/${s.people.id}`).expect(200))
      .body as TableDetail;
    expect(
      detail.incomingRelations.map(({ columnName }) => columnName),
    ).toEqual(['Jefe']);
  });

  it('only sums up a fitting column through a relation that links here', async () => {
    const s = await setup();
    // The relation links to Equipos, not to Empleados.
    await rollup(s.owner, s.people.id, 'Mal', {
      relationColumnId: s.team.id,
      function: 'count',
    }).expect(422);
    // A date can't be added up.
    await rollup(s.owner, s.teams.id, 'Mal', {
      relationColumnId: s.team.id,
      function: 'sum',
      targetColumnId: s.start.id,
    }).expect(422);
    // Counting needs no column; the rest need one.
    await rollup(s.owner, s.teams.id, 'Mal', {
      relationColumnId: s.team.id,
      function: 'count',
      targetColumnId: s.salary.id,
    }).expect(400);
    await rollup(s.owner, s.teams.id, 'Mal', {
      relationColumnId: s.team.id,
      function: 'avg',
    }).expect(400);
    const count = (
      await rollup(s.owner, s.teams.id, 'Personas', {
        relationColumnId: s.team.id,
        function: 'count',
      }).expect(201)
    ).body as TableColumn;
    await s.owner
      .patch(`/api/tables/${s.teams.id}/columns/${count.id}`)
      .send({ type: 'number' })
      .expect(400);
  });

  it('shows nothing of employees the user can’t open', async () => {
    const s = await setup();
    const count = (
      await rollup(s.owner, s.teams.id, 'Personas', {
        relationColumnId: s.team.id,
        function: 'count',
      }).expect(201)
    ).body as TableColumn;
    const viewer = await createSignedInClient(app);
    const viewerUser = (await viewer.get('/api/auth/me').expect(200))
      .body as AuthUser;
    await app.get(PrismaService).tableShare.create({
      data: { tableId: s.teams.id, userId: viewerUser.id, role: 'VIEWER' },
    });

    const page = await list(viewer, s.teams.id);
    expect(page.data.every(({ data }) => !(count.id in data))).toBe(true);
    // Sorting by it would reveal what it sums up.
    await viewer
      .get(`/api/tables/${s.teams.id}/records`)
      .query({ sort: count.id })
      .expect(403);
    const detail = (await viewer.get(`/api/tables/${s.teams.id}`).expect(200))
      .body as TableDetail;
    expect(detail.rollupTargets).toEqual({});
    expect(detail.incomingRelations).toEqual([]);
  });

  it('goes away when what it sums up no longer fits or exists', async () => {
    const s = await setup();
    for (const [columnName, options] of [
      ['Coste', { function: 'sum', targetColumnId: s.salary.id }],
      ['Primera alta', { function: 'min', targetColumnId: s.start.id }],
      ['Personas', { function: 'count' }],
    ] as const) {
      await rollup(s.owner, s.teams.id, columnName, {
        relationColumnId: s.team.id,
        ...options,
      }).expect(201);
    }
    const teamColumns = async () =>
      (
        (await s.owner.get(`/api/tables/${s.teams.id}`).expect(200))
          .body as TableDetail
      ).columns.map(({ name }) => name);

    // A salary turned into text can't be added up any more.
    await s.owner
      .patch(`/api/tables/${s.people.id}/columns/${s.salary.id}`)
      .send({ type: 'text' })
      .expect(200);
    expect(await teamColumns()).toEqual(['Nombre', 'Primera alta', 'Personas']);
    // Without the relation, nothing links teams and employees.
    await s.owner
      .delete(`/api/tables/${s.people.id}/columns/${s.team.id}`)
      .expect(204);
    expect(await teamColumns()).toEqual(['Nombre']);
  });

  it('goes away with the table whose records it sums up', async () => {
    const s = await setup();
    await rollup(s.owner, s.teams.id, 'Personas', {
      relationColumnId: s.team.id,
      function: 'count',
    }).expect(201);
    await s.owner.delete(`/api/tables/${s.people.id}`).expect(204);
    const detail = (await s.owner.get(`/api/tables/${s.teams.id}`).expect(200))
      .body as TableDetail;
    expect(detail.columns.map(({ name }) => name)).toEqual(['Nombre']);
  });
});
