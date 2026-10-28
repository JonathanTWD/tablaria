import { BadRequestException } from '@nestjs/common';
import {
  columnDefinitionSchema,
  STATS_MAX_GROUPS,
  type TableColumn,
} from '@wisedata/shared';
import { statsColumns, summarizeGroups } from './record-stats';

function column(id: string, definition: object): TableColumn {
  return {
    ...columnDefinitionSchema.parse(definition),
    id,
    position: 0,
    createdAt: '',
    updatedAt: '',
  };
}

const status = column('s', { name: 'Estado', type: 'boolean' });
const price = column('p', {
  name: 'Precio',
  type: 'currency',
  options: { currency: 'EUR' },
});
const since = column('d', { name: 'Alta', type: 'date' });

describe('statsColumns', () => {
  it("accepts the table's own groupable and summable columns", () => {
    expect(statsColumns([status, price], { groupBy: 's', sum: 'p' })).toEqual({
      groupBy: status,
      sum: price,
    });
  });

  it('rejects unknown columns and types that make no sense', () => {
    for (const query of [
      { groupBy: 'missing' },
      { groupBy: 'd' },
      { groupBy: 's', sum: 's' },
      { groupBy: 's', sum: 'missing' },
    ]) {
      expect(() => statsColumns([status, price, since], query)).toThrow(
        BadRequestException,
      );
    }
  });
});

describe('summarizeGroups', () => {
  it('adds up the groups that do not fit', () => {
    const groups = Array.from({ length: STATS_MAX_GROUPS + 2 }, (_, index) => ({
      value: `G${index}`,
      count: 1,
      sum: index === STATS_MAX_GROUPS ? null : 2,
    }));

    const stats = summarizeGroups(groups, 10);
    expect(stats.groups).toHaveLength(STATS_MAX_GROUPS);
    expect(stats.others).toEqual({ groupCount: 2, count: 2, sum: 2 });
  });

  it('has no others when every group fits', () => {
    expect(summarizeGroups([], 0)).toEqual({
      total: 0,
      groups: [],
      others: null,
    });
  });
});
