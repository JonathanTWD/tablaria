import { INestApplication } from '@nestjs/common';
import type {
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

describe('Multiple relations (e2e)', () => {
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

  async function list(
    client: TestClient,
    tableId: string,
    query: Record<string, string> = {},
  ) {
    return (
      await client
        .get(`/api/tables/${tableId}/records`)
        .query(query)
        .expect(200)
    ).body as RecordPage;
  }

  /** Employees, and projects each staffed by several of them. */
  async function setup() {
    const owner = await createSignedInClient(app);
    const people = await createTable(owner, 'Empleados');
    const name = await addColumn(owner, people.id, {
      name: 'Nombre',
      type: 'text',
    });
    const personIds: Record<string, string> = {};
    for (const person of ['Lucía', 'Marco', 'Sara']) {
      personIds[person] = (
        await addRecord(owner, people.id, { [name.id]: person })
      ).id;
    }

    const projects = await createTable(owner, 'Proyectos');
    const title = await addColumn(owner, projects.id, {
      name: 'Proyecto',
      type: 'text',
    });
    const budget = await addColumn(owner, projects.id, {
      name: 'Presupuesto',
      type: 'number',
    });
    const members = await addColumn(owner, projects.id, {
      name: 'Equipo',
      type: 'relation',
      options: { tableId: people.id, multiple: true },
    });
    const projectIds: Record<string, string> = {};
    const staffing: [string, number, string[]][] = [
      ['Web', 3000, ['Marco', 'Lucía']],
      ['App', 5000, ['Lucía']],
      ['Tienda', 1000, []],
    ];
    for (const [project, amount, team] of staffing) {
      projectIds[project] = (
        await addRecord(owner, projects.id, {
          [title.id]: project,
          [budget.id]: amount,
          [members.id]: team.map((person) => personIds[person]),
        })
      ).id;
    }
    return {
      owner,
      people,
      name,
      personIds,
      projects,
      title,
      budget,
      members,
      projectIds,
    };
  }

  it('links a record to several, labelled, searched, filtered and sorted', async () => {
    const s = await setup();
    const page = await list(s.owner, s.projects.id);
    expect(page.data.map(({ data }) => data[s.members.id] ?? null)).toEqual([
      [s.personIds['Marco'], s.personIds['Lucía']],
      [s.personIds['Lucía']],
      // An empty list is an empty cell.
      null,
    ]);
    expect(page.linked).toEqual({
      [s.personIds['Lucía']]: 'Lucía',
      [s.personIds['Marco']]: 'Marco',
    });
    expect(page.labelledRelations).toEqual([s.members.id]);

    const titles = (result: RecordPage) =>
      result.data.map(({ data }) => data[s.title.id]);
    expect(
      titles(await list(s.owner, s.projects.id, { search: 'marco' })),
    ).toEqual(['Web']);
    expect(
      titles(
        await list(s.owner, s.projects.id, {
          filters: JSON.stringify([
            { columnId: s.members.id, op: 'contains', value: 'lucía' },
          ]),
        }),
      ),
    ).toEqual(['Web', 'App']);
    // By the labels, alphabetically joined: "Lucía" before "Lucía, Marco".
    expect(
      titles(await list(s.owner, s.projects.id, { sort: s.members.id })),
    ).toEqual(['App', 'Web', 'Tienda']);
    // Not one value per record: it doesn't group.
    await s.owner
      .get(`/api/tables/${s.projects.id}/records`)
      .query({ group: s.members.id })
      .expect(400);

    const csv = await s.owner
      .get(`/api/tables/${s.projects.id}/records/export`)
      .expect(200);
    expect(csv.text).toContain('Web;3000;Marco, Lucía');
  });

  it('only takes existing records of the linked table, each once', async () => {
    const s = await setup();
    const send = (value: unknown) =>
      s.owner
        .post(`/api/tables/${s.projects.id}/records`)
        .send({ data: { [s.members.id]: value } });
    await send([s.personIds['Sara'], s.personIds['Sara']]).expect(400);
    // A multiple relation takes a list, not a single id.
    await send(s.personIds['Sara']).expect(400);
    await send([s.personIds['Sara'], randomUUID()]).expect(422);
    await send([s.projectIds['Web']]).expect(422);
    await send([s.personIds['Sara']]).expect(201);
  });

  it('sums up, for each employee, the projects that list them', async () => {
    const s = await setup();
    const rollup = async (columnName: string, options: object) =>
      (
        await s.owner
          .post(`/api/tables/${s.people.id}/columns`)
          .send({
            name: columnName,
            type: 'rollup',
            options: { relationColumnId: s.members.id, ...options },
          })
          .expect(201)
      ).body as TableColumn;
    const count = await rollup('Proyectos', { function: 'count' });
    const total = await rollup('Presupuesto total', {
      function: 'sum',
      targetColumnId: s.budget.id,
    });

    const page = await list(s.owner, s.people.id);
    expect(
      page.data.map(({ data }) => [
        data[s.name.id],
        data[count.id],
        data[total.id],
      ]),
    ).toEqual([
      ['Lucía', 2, 8000],
      ['Marco', 1, 3000],
      ['Sara', 0, 0],
    ]);

    // Sorted by it, each project counts for everyone it lists (ADR-034).
    const sorted = await list(s.owner, s.people.id, {
      sort: count.id,
      order: 'desc',
    });
    expect(sorted.data.map(({ data }) => data[s.name.id])).toEqual([
      'Lucía',
      'Marco',
      'Sara',
    ]);
  });

  it('takes a deleted record out of the lists that held it', async () => {
    const s = await setup();
    await s.owner
      .delete(`/api/tables/${s.people.id}/records/${s.personIds['Lucía']}`)
      .expect(204);
    const page = await list(s.owner, s.projects.id);
    expect(page.data.map(({ data }) => data[s.members.id] ?? null)).toEqual([
      [s.personIds['Marco']],
      // Its only link is gone: the cell is empty.
      null,
      null,
    ]);
  });

  it('turns links into lists and back, and keeps lookups to single links', async () => {
    const s = await setup();
    const tasks = await createTable(s.owner, 'Tareas');
    const assignee = await addColumn(s.owner, tasks.id, {
      name: 'Responsable',
      type: 'relation',
      options: { tableId: s.people.id },
    });
    await addRecord(s.owner, tasks.id, { [assignee.id]: s.personIds['Sara'] });
    await addColumn(s.owner, tasks.id, {
      name: 'Nombre del responsable',
      type: 'lookup',
      options: { relationColumnId: assignee.id, targetColumnId: s.name.id },
    });
    // A lookup shows one value: it can't read through a list.
    await s.owner
      .post(`/api/tables/${s.projects.id}/columns`)
      .send({
        name: 'Nombres',
        type: 'lookup',
        options: { relationColumnId: s.members.id, targetColumnId: s.name.id },
      })
      .expect(422);

    await s.owner
      .patch(`/api/tables/${tasks.id}/columns/${assignee.id}`)
      .send({ options: { tableId: s.people.id, multiple: true } })
      .expect(200);
    let detail = (await s.owner.get(`/api/tables/${tasks.id}`).expect(200))
      .body as TableDetail;
    expect(detail.columns.map(({ name }) => name)).toEqual(['Responsable']);
    expect((await list(s.owner, tasks.id)).data[0].data[assignee.id]).toEqual([
      s.personIds['Sara'],
    ]);

    // Back to a single link: each list keeps its first record.
    await s.owner
      .patch(`/api/tables/${s.projects.id}/columns/${s.members.id}`)
      .send({ options: { tableId: s.people.id, multiple: false } })
      .expect(200);
    const page = await list(s.owner, s.projects.id);
    expect(page.data.map(({ data }) => data[s.members.id] ?? null)).toEqual([
      s.personIds['Marco'],
      s.personIds['Lucía'],
      null,
    ]);
    detail = (await s.owner.get(`/api/tables/${s.projects.id}`).expect(200))
      .body as TableDetail;
    expect(
      detail.columns.find(({ id }) => id === s.members.id)?.options,
    ).toEqual({ tableId: s.people.id, multiple: false });
  });
});
