import { INestApplication } from '@nestjs/common';
import type {
  AuthUser,
  MetricGroups,
  MetricsSummary,
  TableColumn,
  TableDetail,
  TableRecord,
  Timeline,
} from '@tablaria/shared';
import { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import {
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

describe('Table metrics (e2e)', () => {
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

  /** Employees with a salary, a start date and the team they are in. */
  async function setup() {
    const owner = await createSignedInClient(app);
    const teams = await createTable(owner, 'Equipos');
    const teamName = await addColumn(owner, teams.id, {
      name: 'Nombre',
      type: 'text',
    });
    const teamIds: Record<string, string> = {};
    for (const name of ['Ventas', 'Almacén']) {
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
    const projects = await addColumn(owner, people.id, {
      name: 'Proyectos',
      type: 'relation',
      options: { tableId: teams.id, multiple: true },
    });
    const staff: [string, number | null, string, string | null][] = [
      ['Lucía', 2400, '2026-03-02', 'Ventas'],
      ['Marco', 1800, '2026-03-20', 'Ventas'],
      ['Sara', 2100, '2026-05-11', 'Almacén'],
      ['Iván', null, '2025-12-31', null],
    ];
    for (const [person, pay, date, in_] of staff) {
      await addRecord(owner, people.id, {
        [name.id]: person,
        ...(pay !== null && { [salary.id]: pay }),
        [start.id]: date,
        ...(in_ && { [team.id]: teamIds[in_] }),
      });
    }
    return {
      owner,
      teams,
      teamIds,
      people,
      name,
      salary,
      start,
      team,
      projects,
    };
  }

  const get = async <T>(
    client: TestClient,
    path: string,
    query: Record<string, string> = {},
    status = 200,
  ) => (await client.get(path).query(query).expect(status)).body as T;

  it('sums up every number column', async () => {
    const s = await setup();
    const summary = await get<MetricsSummary>(
      s.owner,
      `/api/tables/${s.people.id}/metrics/summary`,
    );
    expect(summary).toEqual({
      total: 4,
      columns: [
        {
          columnId: s.salary.id,
          // Iván has no salary: he doesn't count in the average.
          filled: 3,
          sum: 6300,
          avg: 2100,
          min: 1800,
          max: 2400,
        },
      ],
    });
  });

  it('groups by a relation, named by the linked record, counted or measured', async () => {
    const s = await setup();
    const groups = (query: Record<string, string>, status = 200) =>
      get<MetricGroups>(
        s.owner,
        `/api/tables/${s.people.id}/metrics/groups`,
        query,
        status,
      );

    const counted = await groups({ groupBy: s.team.id });
    expect(counted).toEqual({
      total: 4,
      groups: [
        { value: s.teamIds['Ventas'], count: 2, filled: 0, measure: null },
        { value: s.teamIds['Almacén'], count: 1, filled: 0, measure: null },
        { value: null, count: 1, filled: 0, measure: null },
      ],
      others: null,
      labels: {
        [s.teamIds['Ventas']]: 'Ventas',
        [s.teamIds['Almacén']]: 'Almacén',
      },
    });

    const highest = await groups({
      groupBy: s.team.id,
      column: s.salary.id,
      fn: 'max',
    });
    expect(
      highest.groups.map(({ count, measure }) => [count, measure]),
    ).toEqual([
      [2, 2400],
      [1, 2100],
      // Nobody without a team has a salary.
      [1, null],
    ]);
    const average = await groups({
      groupBy: s.team.id,
      column: s.salary.id,
      fn: 'avg',
    });
    expect(average.groups[0]).toMatchObject({ filled: 2, measure: 2100 });

    // A list of records isn't one value per record; a date or a text isn't added up.
    await groups({ groupBy: s.projects.id }, 400);
    await groups({ groupBy: s.start.id }, 400);
    await groups({ groupBy: s.team.id, column: s.name.id }, 400);
    await groups(
      { groupBy: s.team.id, column: s.salary.id, fn: 'median' },
      400,
    );
  });

  it('spreads records over time, by when they started or were created', async () => {
    const s = await setup();
    const timeline = (query: Record<string, string>, status = 200) =>
      get<Timeline>(
        s.owner,
        `/api/tables/${s.people.id}/metrics/timeline`,
        query,
        status,
      );

    const monthly = await timeline({
      date: s.start.id,
      column: s.salary.id,
    });
    expect(monthly.buckets).toEqual([
      { start: '2025-12-01', count: 1, filled: 0, measure: null },
      { start: '2026-03-01', count: 2, filled: 2, measure: 4200 },
      { start: '2026-05-01', count: 1, filled: 1, measure: 2100 },
    ]);
    // Weeks start on Monday: 2 March 2026 is one.
    const weekly = await timeline({ date: s.start.id, interval: 'week' });
    expect(weekly.buckets.map(({ start }) => start)).toEqual([
      '2025-12-29',
      '2026-03-02',
      '2026-03-16',
      '2026-05-11',
    ]);
    // Created today, all of them.
    const created = await timeline({ interval: 'day' });
    expect(created.buckets).toHaveLength(1);
    expect(created.buckets[0].count).toBe(4);

    await timeline({ date: s.name.id }, 400);
    await timeline({ interval: 'year' }, 400);
  });

  it('only for tables the user can open, and linked names only from those', async () => {
    const s = await setup();
    const stranger = await createSignedInClient(app);
    await get(stranger, `/api/tables/${s.people.id}/metrics/summary`, {}, 404);

    // Shared Empleados but not Equipos: the teams can't be named.
    const viewer = await createSignedInClient(app);
    const viewerUser = await get<AuthUser>(viewer, '/api/auth/me');
    await app.get(PrismaService).tableShare.create({
      data: { tableId: s.people.id, userId: viewerUser.id, role: 'VIEWER' },
    });
    expect(
      (
        await get<MetricsSummary>(
          viewer,
          `/api/tables/${s.people.id}/metrics/summary`,
        )
      ).total,
    ).toBe(4);
    await get(
      viewer,
      `/api/tables/${s.people.id}/metrics/groups`,
      { groupBy: s.team.id },
      403,
    );
  });
});
