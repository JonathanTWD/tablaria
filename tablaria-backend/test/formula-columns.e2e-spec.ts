import { INestApplication } from '@nestjs/common';
import type {
  FormulaOptions,
  RecordPage,
  TableColumn,
  TableDetail,
  TableRecord,
} from '@tablaria/shared';
import { App } from 'supertest/types';
import {
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

describe('Formula columns (e2e)', () => {
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

  /** Products with a price, a stock and the supplier they come from. */
  async function setup() {
    const owner = await createSignedInClient(app);
    const suppliers = await createTable(owner, 'Proveedores');
    const supplierName = await addColumn(owner, suppliers.id, {
      name: 'Nombre',
      type: 'text',
    });
    const leadTime = await addColumn(owner, suppliers.id, {
      name: 'Plazo',
      type: 'number',
    });
    const acme = await addRecord(owner, suppliers.id, {
      [supplierName.id]: 'Acme',
      [leadTime.id]: 3,
    });

    const products = await createTable(owner, 'Productos');
    const name = await addColumn(owner, products.id, {
      name: 'Nombre',
      type: 'text',
    });
    const price = await addColumn(owner, products.id, {
      name: 'Precio',
      type: 'currency',
      options: { currency: 'EUR' },
    });
    const stock = await addColumn(owner, products.id, {
      name: 'Stock',
      type: 'number',
    });
    const supplier = await addColumn(owner, products.id, {
      name: 'Proveedor',
      type: 'relation',
      options: { tableId: suppliers.id },
    });
    const lookup = await addColumn(owner, products.id, {
      name: 'Plazo del proveedor',
      type: 'lookup',
      options: { relationColumnId: supplier.id, targetColumnId: leadTime.id },
    });
    await addRecord(owner, products.id, {
      [name.id]: 'Tornillo',
      [price.id]: 0.1,
      [stock.id]: 300,
      [supplier.id]: acme.id,
    });
    await addRecord(owner, products.id, {
      [name.id]: 'Tuerca',
      [price.id]: 0.05,
    });
    return {
      owner,
      suppliers,
      leadTime,
      products,
      name,
      price,
      stock,
      supplier,
      lookup,
    };
  }

  function formula(
    client: TestClient,
    tableId: string,
    columnName: string,
    expression: string,
    currency: string | null = null,
  ) {
    return client.post(`/api/tables/${tableId}/columns`).send({
      name: columnName,
      type: 'formula',
      options: { expression, currency },
    });
  }

  async function list(client: TestClient, tableId: string) {
    return (
      await client.get(`/api/tables/${tableId}/records?order=asc`).expect(200)
    ).body as RecordPage;
  }

  async function columnsOf(client: TestClient, tableId: string) {
    return (
      (await client.get(`/api/tables/${tableId}`).expect(200))
        .body as TableDetail
    ).columns;
  }

  it('computes each record’s value from its cells, citing columns by name', async () => {
    const s = await setup();
    const value = (
      await formula(
        s.owner,
        s.products.id,
        'Valor',
        '{Precio} * {stock}',
        'EUR',
      ).expect(201)
    ).body as TableColumn;
    const options = value.options as FormulaOptions;
    // Stored by id, so renaming a column breaks nothing.
    expect(options).toEqual({
      expression: `{${s.price.id}} * {${s.stock.id}}`,
      currency: 'EUR',
      resultType: 'number',
    });
    const label = (
      await formula(
        s.owner,
        s.products.id,
        'Etiqueta',
        `{Nombre} & " · " & SI({Plazo del proveedor} > 2, "lento", "rápido")`,
      ).expect(201)
    ).body as TableColumn;
    expect((label.options as FormulaOptions).resultType).toBe('text');

    const page = await list(s.owner, s.products.id);
    expect(
      page.data.map(({ data }) => [data[value.id], data[label.id]]),
    ).toEqual([
      [30, 'Tornillo · lento'],
      // No stock: no value. No supplier: the condition is false.
      [undefined, 'Tuerca · rápido'],
    ]);

    await s.owner
      .patch(`/api/tables/${s.products.id}/columns/${s.stock.id}`)
      .send({ name: 'Existencias' })
      .expect(200);
    const csv = await s.owner
      .get(`/api/tables/${s.products.id}/records/export`)
      .expect(200);
    expect(csv.text).toContain('Valor (EUR)');
    expect(csv.text).toContain(';30;Tornillo · lento');
  });

  it('refuses formulas that don’t fit, and writing, sorting or filtering by one', async () => {
    const s = await setup();
    for (const expression of [
      '{Coste} * 2',
      '{Nombre} * 2',
      '{Proveedor} & ""',
      'SI({Stock} > 1, 1, "uno")',
      '{Precio} *',
    ]) {
      await formula(s.owner, s.products.id, 'Mal', expression).expect(422);
    }
    // A currency only fits a number.
    await formula(s.owner, s.products.id, 'Mal', '{Nombre}', 'EUR').expect(422);
    await s.owner
      .post(`/api/tables/${s.products.id}/columns`)
      .send({
        name: 'Mal',
        type: 'formula',
        required: true,
        options: { expression: '1' },
      })
      .expect(400);

    const value = (
      await formula(
        s.owner,
        s.products.id,
        'Valor',
        '{Precio} * {Stock}',
      ).expect(201)
    ).body as TableColumn;
    // Formulas can't cite other formulas.
    await formula(s.owner, s.products.id, 'Doble', '{Valor} * 2').expect(422);
    await s.owner
      .post(`/api/tables/${s.products.id}/records`)
      .send({ data: { [value.id]: 3 } })
      .expect(400);
    await s.owner
      .get(`/api/tables/${s.products.id}/records?sort=${value.id}`)
      .expect(400);
    await s.owner
      .patch(`/api/tables/${s.products.id}/columns/${value.id}`)
      .send({ type: 'number' })
      .expect(400);
  });

  it('follows the type of what it cites, and goes away when that no longer fits', async () => {
    const s = await setup();
    const either = (
      await formula(
        s.owner,
        s.products.id,
        'Stock o nada',
        'SI(VERDADERO; {Stock})',
        'EUR',
      ).expect(201)
    ).body as TableColumn;
    await formula(s.owner, s.products.id, 'Doble', '{Stock} * 2').expect(201);
    await formula(
      s.owner,
      s.products.id,
      'Plazo doble',
      '{Plazo del proveedor} * 2',
    ).expect(201);

    // Stock as text: doubling it means nothing, showing it still does.
    await s.owner
      .patch(`/api/tables/${s.products.id}/columns/${s.stock.id}`)
      .send({ type: 'text' })
      .expect(200);
    let columns = await columnsOf(s.owner, s.products.id);
    expect(columns.map(({ name }) => name)).not.toContain('Doble');
    const retyped = columns.find(({ id }) => id === either.id);
    // A text can't be a price: the currency goes, the formula stays.
    expect(retyped?.options).toMatchObject({
      resultType: 'text',
      currency: null,
    });

    // The lead time the lookup shows turns into text in the other table.
    await s.owner
      .patch(`/api/tables/${s.suppliers.id}/columns/${s.leadTime.id}`)
      .send({ type: 'text' })
      .expect(200);
    columns = await columnsOf(s.owner, s.products.id);
    expect(columns.map(({ name }) => name)).not.toContain('Plazo doble');

    // Deleting a cited column takes the formula with it.
    await s.owner
      .delete(`/api/tables/${s.products.id}/columns/${s.stock.id}`)
      .expect(204);
    columns = await columnsOf(s.owner, s.products.id);
    expect(columns.map(({ name }) => name)).not.toContain('Stock o nada');
  });

  it('goes away with the lookup it cites when the linked table is deleted', async () => {
    const s = await setup();
    await formula(
      s.owner,
      s.products.id,
      'Plazo doble',
      '{Plazo del proveedor} * 2',
    ).expect(201);
    await formula(s.owner, s.products.id, 'Valor', '{Precio} * {Stock}').expect(
      201,
    );
    await s.owner.delete(`/api/tables/${s.suppliers.id}`).expect(204);
    const columns = await columnsOf(s.owner, s.products.id);
    expect(columns.map(({ name }) => name)).toEqual([
      'Nombre',
      'Precio',
      'Stock',
      'Valor',
    ]);
  });
});
