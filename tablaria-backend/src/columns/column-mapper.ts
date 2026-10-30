import type { ColumnDefinition, TableColumn } from '@tablaria/shared';
import { type Column, Prisma } from '../generated/prisma/client';

/** Prisma write payload for a validated column definition. */
export function toColumnData(definition: ColumnDefinition) {
  return {
    name: definition.name,
    type: definition.type,
    required: definition.required,
    unique: definition.unique,
    stock: definition.stock,
    // A JSON column needs DbNull for SQL NULL; plain `null` is rejected.
    options: definition.options ?? Prisma.DbNull,
    defaultValue: definition.defaultValue ?? Prisma.DbNull,
  };
}

export function toTableColumn(column: Column): TableColumn {
  // options and defaultValue were validated against the column type when written.
  const definition = {
    name: column.name,
    type: column.type,
    required: column.required,
    unique: column.unique,
    stock: column.stock,
    options: column.options,
    defaultValue: column.defaultValue,
  } as ColumnDefinition;

  return {
    ...definition,
    id: column.id,
    position: column.position,
    createdAt: column.createdAt.toISOString(),
    updatedAt: column.updatedAt.toISOString(),
  };
}
