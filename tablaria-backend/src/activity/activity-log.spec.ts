import type { RecordColumn } from '@tablaria/shared';
import { changedColumns } from './activity-log';

const team = {
  id: 'team',
  name: 'Equipo',
  type: 'relation',
  options: { tableId: 'people', multiple: true },
} as RecordColumn;

describe('changedColumns', () => {
  it('compares the lists of a multiple relation by their contents', () => {
    expect(
      changedColumns([team], { team: ['a', 'b'] }, { team: ['a', 'b'] }),
    ).toEqual([]);
    expect(
      changedColumns([team], { team: ['a', 'b'] }, { team: ['a'] }),
    ).toEqual(['Equipo']);
    expect(changedColumns([team], {}, { team: ['a'] })).toEqual(['Equipo']);
  });
});
