import { COLUMN_TYPES } from '@tablaria/shared';
import { ColumnType } from '../generated/prisma/client';

// The database enum and the shared list must stay identical; adding a type
// requires both a shared change and a Prisma migration.
describe('ColumnType enum', () => {
  it('matches COLUMN_TYPES from @tablaria/shared', () => {
    expect(Object.values(ColumnType).sort()).toEqual([...COLUMN_TYPES].sort());
  });
});
