import { BadRequestException } from '@nestjs/common';
import { columnDefinitionSchema, type RecordColumn } from '@wisedata/shared';
import { randomUUID } from 'node:crypto';
import { buildRecordQuery, escapeLike } from './record-query';

function column(definition: object): RecordColumn {
  return {
    id: randomUUID(),
    ...columnDefinitionSchema.parse({ name: 'Column', ...definition }),
  };
}

const name = column({ type: 'text' });
const quantity = column({ type: 'number' });
const bought = column({ type: 'date' });
const status = column({
  type: 'select',
  options: { choices: [{ id: 'a', label: 'En uso', color: 'green' }] },
});
const columns = [name, quantity, bought, status];
const tableId = randomUUID();
const base = { order: 'asc' as const, filters: [] };

describe('buildRecordQuery', () => {
  it('keeps user input out of the SQL text', () => {
    const attack = "x'); DROP TABLE records; --";
    const { where } = buildRecordQuery(tableId, columns, {
      ...base,
      search: attack,
      filters: [{ columnId: name.id, op: 'contains', value: attack }],
    });

    expect(where.sql).not.toContain('DROP');
    expect(where.sql).not.toContain(name.id);
    expect(where.values).toEqual(
      expect.arrayContaining([`%${attack}%`, name.id, status.id]),
    );
  });

  it('searches only text and select columns', () => {
    const { where } = buildRecordQuery(tableId, columns, {
      ...base,
      search: 'taladro',
    });

    expect(where.values).toEqual(expect.arrayContaining([name.id, status.id]));
    expect(where.values).not.toContain(quantity.id);
  });

  it('casts range bounds to the column type', () => {
    const { where } = buildRecordQuery(tableId, columns, {
      ...base,
      filters: [
        { columnId: quantity.id, op: 'between', min: 1, max: 10 },
        { columnId: bought.id, op: 'between', min: '2026-01-01' },
      ],
    });

    expect(where.sql).toContain('::numeric >=');
    expect(where.sql).toContain('::date >=');
    expect(where.values).toEqual(expect.arrayContaining([1, 10, '2026-01-01']));
  });

  it('sorts by the typed value and keeps empty cells last', () => {
    const { orderBy } = buildRecordQuery(tableId, columns, {
      ...base,
      sort: quantity.id,
      order: 'desc',
    });

    expect(orderBy.sql).toContain('::numeric DESC NULLS LAST');
  });

  it('rejects columns that are not in the table', () => {
    expect(() =>
      buildRecordQuery(tableId, columns, { ...base, sort: randomUUID() }),
    ).toThrow(BadRequestException);
    expect(() =>
      buildRecordQuery(tableId, columns, {
        ...base,
        filters: [{ columnId: randomUUID(), op: 'is', value: true }],
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects filters that do not fit the column type', () => {
    expect(() =>
      buildRecordQuery(tableId, columns, {
        ...base,
        filters: [{ columnId: quantity.id, op: 'contains', value: '3' }],
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      buildRecordQuery(tableId, columns, {
        ...base,
        filters: [{ columnId: quantity.id, op: 'between', min: '2026-01-01' }],
      }),
    ).toThrow(BadRequestException);
  });
});

describe('escapeLike', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});
