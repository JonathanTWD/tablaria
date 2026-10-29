import { INestApplication } from '@nestjs/common';
import {
  type ApiErrorBody,
  MAX_COLUMNS_PER_TABLE,
  MAX_TABLES_PER_SPACE,
  type TableColumn,
  type TableDetail,
  type TableSummary,
  type UpdateColumnResponse,
} from '@wisedata/shared';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import type { Prisma } from '../src/generated/prisma/client';
import {
  createClient,
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

const STATUS_OPTIONS = {
  choices: [
    { id: 'in-use', label: 'En uso', color: 'green' },
    { id: 'repair', label: 'En reparación', color: 'amber' },
    { id: 'retired', label: 'De baja', color: 'red' },
  ],
};

describe('Tables and columns (e2e)', () => {
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

  async function createTable(
    client: TestClient,
    body: object = { name: 'Almacén' },
  ): Promise<TableDetail> {
    const response = await client.post('/api/tables').send(body).expect(201);
    return response.body as TableDetail;
  }

  async function addColumn(
    client: TestClient,
    tableId: string,
    body: object,
  ): Promise<TableColumn> {
    const response = await client
      .post(`/api/tables/${tableId}/columns`)
      .send(body)
      .expect(201);
    return response.body as TableColumn;
  }

  /** Records are written directly until the records API exists. */
  async function insertRecords(
    tableId: string,
    rows: Prisma.InputJsonObject[],
  ): Promise<string[]> {
    const records = await prisma.record.createManyAndReturn({
      data: rows.map((data) => ({ tableId, data })),
      select: { id: true },
    });
    return records.map(({ id }) => id);
  }

  async function recordData(ids: string[]) {
    const records = await prisma.record.findMany({
      where: { id: { in: ids } },
    });
    return ids.map((id) => records.find((record) => record.id === id)?.data);
  }

  it('requires a session', async () => {
    await createClient(app).get('/api/tables').expect(401);
  });

  describe('tables', () => {
    it('creates, lists, renames and deletes a blank table', async () => {
      const client = await createSignedInClient(app);

      const created = await createTable(client, {
        name: '  Almacén central ',
        description: 'Stock del local',
      });
      expect(created).toMatchObject({
        name: 'Almacén central',
        description: 'Stock del local',
        columnCount: 0,
        recordCount: 0,
        columns: [],
      });

      const list = await client.get('/api/tables').expect(200);
      expect((list.body as TableSummary[]).map(({ id }) => id)).toEqual([
        created.id,
      ]);

      const renamed = await client
        .patch(`/api/tables/${created.id}`)
        .send({ name: 'Almacén', description: '   ' })
        .expect(200);
      expect(renamed.body).toMatchObject({
        name: 'Almacén',
        description: null,
      });

      await client.delete(`/api/tables/${created.id}`).expect(204);
      await client.get(`/api/tables/${created.id}`).expect(404);
    });

    it('creates a table from a template with its columns in order', async () => {
      const client = await createSignedInClient(app);

      const table = await createTable(client, {
        name: 'Equipos',
        templateId: 'assets',
      });

      expect(table.columnCount).toBe(6);
      expect(
        table.columns.map(({ name, position }) => [name, position]),
      ).toEqual([
        ['Equipo', 0],
        ['Nº de serie', 1],
        ['Estado', 2],
        ['Asignado a', 3],
        ['Fecha de compra', 4],
        ['Valor', 5],
      ]);
      expect(table.columns[2]).toMatchObject({
        type: 'select',
        defaultValue: 'En uso',
      });
      expect(table.columns[5]).toMatchObject({
        type: 'currency',
        options: { currency: 'EUR' },
        defaultValue: null,
      });
    });

    it('lists the most recently edited tables first, with record counts', async () => {
      const client = await createSignedInClient(app);
      const first = await createTable(client, { name: 'Primera' });
      const second = await createTable(client, { name: 'Segunda' });
      await insertRecords(first.id, [{}, {}]);

      // Changing a column counts as editing the table.
      await addColumn(client, first.id, { name: 'Nombre', type: 'text' });

      const list = await client.get('/api/tables').expect(200);
      const tables = list.body as TableSummary[];
      expect(tables.map(({ id }) => id)).toEqual([first.id, second.id]);
      expect(tables[0]).toMatchObject({ columnCount: 1, recordCount: 2 });
    });

    it('rejects invalid input', async () => {
      const client = await createSignedInClient(app);

      const blank = await client
        .post('/api/tables')
        .send({ name: '  ' })
        .expect(400);
      expect((blank.body as ApiErrorBody).details?.[0].path).toBe('name');
      await client
        .post('/api/tables')
        .send({ name: 'Tabla', templateId: 'unknown' })
        .expect(400);
      await client.patch(`/api/tables/${randomUUID()}`).send({}).expect(400);
      await client.get('/api/tables/not-a-uuid').expect(400);
      await client.get(`/api/tables/${randomUUID()}`).expect(404);
    });

    it('limits how many tables a user can have', async () => {
      const client = await createSignedInClient(app);
      // Listing creates the personal space on first use.
      await client.get('/api/tables').expect(200);
      const { id: organizationId } =
        await prisma.organization.findFirstOrThrow();
      await prisma.inventoryTable.createMany({
        data: Array.from({ length: MAX_TABLES_PER_SPACE }, (_, index) => ({
          organizationId,
          name: `Tabla ${index}`,
        })),
      });

      const response = await client
        .post('/api/tables')
        .send({ name: 'Una más' })
        .expect(422);
      expect((response.body as ApiErrorBody).message).toBe(
        'Table limit reached',
      );
    });
  });

  describe('columns', () => {
    it('adds columns at the end and rejects duplicate names', async () => {
      const client = await createSignedInClient(app);
      const table = await createTable(client);

      const name = await addColumn(client, table.id, {
        name: 'Producto',
        type: 'text',
      });
      const price = await addColumn(client, table.id, {
        name: 'Precio',
        type: 'currency',
        required: true,
        options: { currency: 'USD' },
      });
      expect(name).toMatchObject({
        position: 0,
        required: false,
        options: null,
      });
      expect(price).toMatchObject({
        position: 1,
        required: true,
        options: { currency: 'USD' },
      });

      const duplicate = await client
        .post(`/api/tables/${table.id}/columns`)
        .send({ name: 'Producto', type: 'number' })
        .expect(409);
      expect((duplicate.body as ApiErrorBody).message).toBe(
        'A column with this name already exists',
      );

      const columns = await client
        .get(`/api/tables/${table.id}/columns`)
        .expect(200);
      expect((columns.body as TableColumn[]).map(({ id }) => id)).toEqual([
        name.id,
        price.id,
      ]);
    });

    it('validates settings against the column type', async () => {
      const client = await createSignedInClient(app);
      const table = await createTable(client);
      const url = `/api/tables/${table.id}/columns`;

      await client
        .post(url)
        .send({ name: 'Precio', type: 'currency' })
        .expect(400);
      await client
        .post(url)
        .send({
          name: 'Precio',
          type: 'currency',
          options: { currency: 'XYZ' },
        })
        .expect(400);
      await client
        .post(url)
        .send({ name: 'Cantidad', type: 'number', defaultValue: 'diez' })
        .expect(400);
      const badDefault = await client
        .post(url)
        .send({
          name: 'Estado',
          type: 'select',
          options: STATUS_OPTIONS,
          defaultValue: 'Perdido',
        })
        .expect(400);
      expect((badDefault.body as ApiErrorBody).details?.[0].path).toBe(
        'defaultValue',
      );
    });

    it('fills the default value into existing records', async () => {
      const client = await createSignedInClient(app);
      const table = await createTable(client);
      const ids = await insertRecords(table.id, [{}, {}]);

      const quantity = await addColumn(client, table.id, {
        name: 'Cantidad',
        type: 'number',
        defaultValue: 0,
      });

      expect(await recordData(ids)).toEqual([
        { [quantity.id]: 0 },
        { [quantity.id]: 0 },
      ]);
    });

    it('converts stored values when the type changes and reports emptied cells', async () => {
      const client = await createSignedInClient(app);
      const table = await createTable(client);
      const column = await addColumn(client, table.id, {
        name: 'Cantidad',
        type: 'text',
      });
      const ids = await insertRecords(table.id, [
        { [column.id]: '12' },
        { [column.id]: '3,5' },
        { [column.id]: 'muchas', other: 'kept' },
        {},
      ]);

      const response = await client
        .patch(`/api/tables/${table.id}/columns/${column.id}`)
        .send({ type: 'number', defaultValue: 1 })
        .expect(200);

      const body = response.body as UpdateColumnResponse;
      expect(body.clearedValues).toBe(1);
      expect(body.column).toMatchObject({ type: 'number', defaultValue: 1 });
      expect(await recordData(ids)).toEqual([
        { [column.id]: 12 },
        { [column.id]: 3.5 },
        { other: 'kept' },
        {},
      ]);
    });

    it('resets settings of the old type unless new ones are sent', async () => {
      const client = await createSignedInClient(app);
      const table = await createTable(client);
      const price = await addColumn(client, table.id, {
        name: 'Precio',
        type: 'currency',
        options: { currency: 'EUR' },
        defaultValue: 10,
      });
      const url = `/api/tables/${table.id}/columns/${price.id}`;

      const asNumber = await client
        .patch(url)
        .send({ type: 'number' })
        .expect(200);
      expect((asNumber.body as UpdateColumnResponse).column).toMatchObject({
        options: null,
        defaultValue: null,
      });

      // A currency needs its code again.
      await client.patch(url).send({ type: 'currency' }).expect(400);
      await client
        .patch(url)
        .send({ type: 'currency', options: { currency: 'MXN' } })
        .expect(200);
    });

    it('carries renamed choices into records and empties removed ones', async () => {
      const client = await createSignedInClient(app);
      const table = await createTable(client);
      const status = await addColumn(client, table.id, {
        name: 'Estado',
        type: 'select',
        options: STATUS_OPTIONS,
      });
      const ids = await insertRecords(table.id, [
        { [status.id]: 'En uso' },
        { [status.id]: 'De baja' },
        { [status.id]: 'En reparación' },
      ]);

      const response = await client
        .patch(`/api/tables/${table.id}/columns/${status.id}`)
        .send({
          options: {
            choices: [
              { id: 'in-use', label: 'Activo', color: 'green' },
              { id: 'repair', label: 'En reparación', color: 'amber' },
            ],
          },
        })
        .expect(200);

      expect((response.body as UpdateColumnResponse).clearedValues).toBe(1);
      expect(await recordData(ids)).toEqual([
        { [status.id]: 'Activo' },
        {},
        { [status.id]: 'En reparación' },
      ]);
    });

    it('keeps select settings on a partial change and moves the default with its choice', async () => {
      const client = await createSignedInClient(app);
      const table = await createTable(client);
      const status = await addColumn(client, table.id, {
        name: 'Estado',
        type: 'select',
        options: STATUS_OPTIONS,
        defaultValue: 'En uso',
      });
      const url = `/api/tables/${table.id}/columns/${status.id}`;

      const renamed = await client
        .patch(url)
        .send({ name: 'Situación' })
        .expect(200);
      expect((renamed.body as UpdateColumnResponse).column).toMatchObject({
        options: STATUS_OPTIONS,
        defaultValue: 'En uso',
      });

      const [inUse, ...others] = STATUS_OPTIONS.choices;
      const relabeled = await client
        .patch(url)
        .send({
          options: { choices: [{ ...inUse, label: 'Activo' }, ...others] },
        })
        .expect(200);
      expect((relabeled.body as UpdateColumnResponse).column.defaultValue).toBe(
        'Activo',
      );

      const removed = await client
        .patch(url)
        .send({ options: { choices: others } })
        .expect(200);
      expect(
        (removed.body as UpdateColumnResponse).column.defaultValue,
      ).toBeNull();
    });

    it('renames a column without touching its values', async () => {
      const client = await createSignedInClient(app);
      const table = await createTable(client);
      const column = await addColumn(client, table.id, {
        name: 'Nombre',
        type: 'text',
      });
      const [id] = await insertRecords(table.id, [{ [column.id]: 'Taladro' }]);

      const response = await client
        .patch(`/api/tables/${table.id}/columns/${column.id}`)
        .send({ name: 'Producto', required: true })
        .expect(200);

      expect(response.body).toEqual({
        column: expect.objectContaining({
          name: 'Producto',
          required: true,
        }) as unknown,
        clearedValues: 0,
      });
      expect(await recordData([id])).toEqual([{ [column.id]: 'Taladro' }]);
    });

    it('reorders columns only with the complete list of ids', async () => {
      const client = await createSignedInClient(app);
      const table = await createTable(client, {
        name: 'Inventario',
        templateId: 'basic-inventory',
      });
      const ids = table.columns.map(({ id }) => id);
      const url = `/api/tables/${table.id}/columns/order`;

      const reversed = [...ids].reverse();
      const response = await client
        .patch(url)
        .send({ columnIds: reversed })
        .expect(200);
      expect((response.body as TableColumn[]).map(({ id }) => id)).toEqual(
        reversed,
      );

      await client
        .patch(url)
        .send({ columnIds: ids.slice(1) })
        .expect(400);
      await client
        .patch(url)
        .send({ columnIds: [...ids.slice(1), randomUUID()] })
        .expect(400);
      await client
        .patch(url)
        .send({ columnIds: [ids[0], ids[0]] })
        .expect(400);
    });

    it('deletes a column and its values', async () => {
      const client = await createSignedInClient(app);
      const table = await createTable(client);
      const name = await addColumn(client, table.id, {
        name: 'Nombre',
        type: 'text',
      });
      const notes = await addColumn(client, table.id, {
        name: 'Notas',
        type: 'text',
      });
      const [id] = await insertRecords(table.id, [
        { [name.id]: 'Taladro', [notes.id]: 'Revisar' },
      ]);

      await client
        .delete(`/api/tables/${table.id}/columns/${notes.id}`)
        .expect(204);

      expect(await recordData([id])).toEqual([{ [name.id]: 'Taladro' }]);
      await client
        .delete(`/api/tables/${table.id}/columns/${notes.id}`)
        .expect(404);
    });

    it('limits how many columns a table can have', async () => {
      const client = await createSignedInClient(app);
      const table = await createTable(client);
      await prisma.column.createMany({
        data: Array.from({ length: MAX_COLUMNS_PER_TABLE }, (_, position) => ({
          tableId: table.id,
          name: `Columna ${position}`,
          type: 'text' as const,
          position,
        })),
      });

      await client
        .post(`/api/tables/${table.id}/columns`)
        .send({ name: 'Una más', type: 'text' })
        .expect(422);
    });
  });

  it("never exposes or changes another user's tables", async () => {
    const owner = await createSignedInClient(app);
    const other = await createSignedInClient(app);
    const table = await createTable(owner, {
      name: 'Privada',
      templateId: 'basic-inventory',
    });
    const [column] = table.columns;
    const tableUrl = `/api/tables/${table.id}`;
    const columnsUrl = `${tableUrl}/columns`;

    const list = await other.get('/api/tables').expect(200);
    expect(list.body).toEqual([]);

    await other.get(tableUrl).expect(404);
    await other.patch(tableUrl).send({ name: 'Mía' }).expect(404);
    await other.delete(tableUrl).expect(404);
    await other.get(columnsUrl).expect(404);
    await other
      .post(columnsUrl)
      .send({ name: 'Intrusa', type: 'text' })
      .expect(404);
    await other
      .patch(`${columnsUrl}/order`)
      .send({ columnIds: table.columns.map(({ id }) => id) })
      .expect(404);
    await other
      .patch(`${columnsUrl}/${column.id}`)
      .send({ name: 'Mía' })
      .expect(404);
    await other.delete(`${columnsUrl}/${column.id}`).expect(404);

    // A column id from another table is not reachable through the caller's own table.
    const own = await createTable(other, { name: 'Propia' });
    await other
      .patch(`/api/tables/${own.id}/columns/${column.id}`)
      .send({ name: 'Mía' })
      .expect(404);

    const unchanged = await owner.get(tableUrl).expect(200);
    expect(unchanged.body).toEqual({
      ...table,
      updatedAt: expect.any(String) as string,
    });
  });
});
