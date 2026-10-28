import { INestApplication } from '@nestjs/common';
import type {
  AuthUser,
  StockAlerts,
  TableDetail,
  TableRecord,
} from '@wisedata/shared';
import { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import type { Role } from '../src/generated/prisma/client';
import {
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

/**
 * Access through a direct share or an organization membership (ADR-019).
 * The API for sharing comes later; these tests set up access in the database.
 */
describe('Table access by role (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function userId(client: TestClient): Promise<string> {
    return ((await client.get('/api/auth/me').expect(200)).body as AuthUser).id;
  }

  /** An owner's inventory with one low-stock record, plus a signed-in stranger. */
  async function setup() {
    const owner = await createSignedInClient(app);
    const table = (
      await owner
        .post('/api/tables')
        .send({ name: 'Almacén', templateId: 'basic-inventory' })
        .expect(201)
    ).body as TableDetail;
    const column = (name: string) =>
      table.columns.find((candidate) => candidate.name === name)?.id ?? '';
    const record = (
      await owner
        .post(`/api/tables/${table.id}/records`)
        .send({
          data: { [column('Producto')]: 'Guantes', [column('Cantidad')]: 2 },
        })
        .expect(201)
    ).body as TableRecord;
    const guest = await createSignedInClient(app);
    return {
      owner,
      table,
      column,
      record,
      guest,
      guestId: await userId(guest),
    };
  }

  const share = (tableId: string, userId: string, role: Role) =>
    prisma.tableShare.create({ data: { tableId, userId, role } });

  /** Every kind of request, with the status a client with this access gets. */
  async function expectAccess(
    client: TestClient,
    { table, column, record }: Awaited<ReturnType<typeof setup>>,
    expected: { read: number; writeRecords: number; manageTable: number },
  ) {
    const base = `/api/tables/${table.id}`;
    await client.get(base).expect(expected.read);
    await client.get(`${base}/records`).expect(expected.read);
    await client.get(`${base}/records/export`).expect(expected.read);
    await client
      .get(`${base}/records/stats`)
      .query({ groupBy: column('Ubicación') })
      .expect(expected.read);

    await client
      .post(`${base}/records`)
      .send({ data: { [column('Producto')]: 'Bridas' } })
      .expect(expected.writeRecords === 200 ? 201 : expected.writeRecords);
    await client
      .patch(`${base}/records/${record.id}`)
      .send({ data: { [column('Cantidad')]: 3 } })
      .expect(expected.writeRecords);

    await client
      .patch(base)
      .send({ name: 'Renombrada' })
      .expect(expected.manageTable);
    await client
      .post(`${base}/columns`)
      .send({ name: 'Proveedor', type: 'text' })
      .expect(expected.manageTable === 200 ? 201 : expected.manageTable);
  }

  it('hides tables from people without access, as if they did not exist', async () => {
    const context = await setup();
    await expectAccess(context.guest, context, {
      read: 404,
      writeRecords: 404,
      manageTable: 404,
    });
    expect(
      (await context.guest.get('/api/stock-alerts').expect(200)).body,
    ).toEqual({
      total: 0,
      items: [],
    });
  });

  it('lets a viewer read and export, but not change anything', async () => {
    const context = await setup();
    await share(context.table.id, context.guestId, 'VIEWER');

    await expectAccess(context.guest, context, {
      read: 200,
      writeRecords: 403,
      manageTable: 403,
    });
    await context.guest
      .delete(`/api/tables/${context.table.id}/records/${context.record.id}`)
      .expect(403);
    await context.guest.delete(`/api/tables/${context.table.id}`).expect(403);
  });

  it('lets an editor change records, but not the table or its columns', async () => {
    const context = await setup();
    await share(context.table.id, context.guestId, 'EDITOR');

    await expectAccess(context.guest, context, {
      read: 200,
      writeRecords: 200,
      manageTable: 403,
    });
    await context.guest
      .delete(`/api/tables/${context.table.id}/records/${context.record.id}`)
      .expect(204);
  });

  it('shows alerts of shared tables and stops the moment access is revoked', async () => {
    const context = await setup();
    await share(context.table.id, context.guestId, 'VIEWER');
    const alerts = (await context.guest.get('/api/stock-alerts').expect(200))
      .body as StockAlerts;
    expect(alerts.items).toEqual([
      expect.objectContaining({
        tableId: context.table.id,
        label: 'Guantes',
      }) as unknown,
    ]);

    await prisma.tableShare.deleteMany({ where: { userId: context.guestId } });
    await context.guest.get(`/api/tables/${context.table.id}`).expect(404);
  });

  it('gives organization members the access of their role', async () => {
    const context = await setup();
    const [admin, viewer] = [context.guest, await createSignedInClient(app)];
    const organization = await prisma.organization.create({
      data: {
        name: 'Ferretería López',
        memberships: {
          create: [
            { userId: context.guestId, role: 'ADMIN' },
            { userId: await userId(viewer), role: 'VIEWER' },
          ],
        },
      },
    });
    await prisma.inventoryTable.update({
      where: { id: context.table.id },
      data: { organizationId: organization.id },
    });

    await expectAccess(admin, context, {
      read: 200,
      writeRecords: 200,
      manageTable: 200,
    });
    await expectAccess(viewer, context, {
      read: 200,
      writeRecords: 403,
      manageTable: 403,
    });
    // The former owner is no longer a member of the organization.
    await context.owner.get(`/api/tables/${context.table.id}`).expect(404);
  });

  it('uses the higher of the organization role and a direct share', async () => {
    const context = await setup();
    const organization = await prisma.organization.create({
      data: {
        name: 'Ferretería López',
        memberships: { create: { userId: context.guestId, role: 'VIEWER' } },
      },
    });
    await prisma.inventoryTable.update({
      where: { id: context.table.id },
      data: { organizationId: organization.id },
    });
    await share(context.table.id, context.guestId, 'EDITOR');

    await context.guest
      .patch(`/api/tables/${context.table.id}/records/${context.record.id}`)
      .send({ data: { [context.column('Cantidad')]: 9 } })
      .expect(200);
  });

  it('never lets a share grant more than editing', async () => {
    const context = await setup();
    await expect(
      share(context.table.id, context.guestId, 'ADMIN'),
    ).rejects.toThrow();
  });

  it('keeps table management to admins, whichever way the access came', async () => {
    const context = await setup();
    const strangerContext = context.guest;
    const editor = await createSignedInClient(app);
    const organization = await prisma.organization.create({
      data: {
        name: 'Ferretería López',
        memberships: {
          create: { userId: await userId(editor), role: 'EDITOR' },
        },
      },
    });
    await prisma.inventoryTable.update({
      where: { id: context.table.id },
      data: { organizationId: organization.id },
    });
    const base = `/api/tables/${context.table.id}`;
    const columnIds = context.table.columns.map(({ id }) => id);

    await editor.get(`${base}/columns`).expect(200);
    await editor
      .patch(`${base}/columns/${columnIds[0]}`)
      .send({ name: 'Nombre' })
      .expect(403);
    await editor
      .patch(`${base}/columns/order`)
      .send({ columnIds: [...columnIds].reverse() })
      .expect(403);
    await editor.delete(`${base}/columns/${columnIds[1]}`).expect(403);
    await editor.delete(base).expect(403);

    await strangerContext
      .delete(`${base}/records/${context.record.id}`)
      .expect(404);
    await strangerContext.delete(`${base}/columns/${columnIds[1]}`).expect(404);
  });
});
