import {
  type ColumnDefinition,
  columnDefinitionSchema,
} from '@wisedata/shared';
import { importCellValue } from './import-value';

function column(definition: object): ColumnDefinition {
  return columnDefinitionSchema.parse(definition);
}

const number = column({ name: 'Stock', type: 'number' });
const price = column({
  name: 'Precio',
  type: 'currency',
  options: { currency: 'EUR' },
});
const date = column({ name: 'Revisión', type: 'date' });
const flag = column({ name: 'Destacado', type: 'boolean' });
const text = column({ name: 'Producto', type: 'text' });
const status = column({
  name: 'Estado',
  type: 'select',
  options: {
    choices: [{ id: 'a', label: 'Disponible', color: 'green' }],
  },
});

describe('importCellValue', () => {
  it('reads numbers as spreadsheets and our export write them', () => {
    expect(importCellValue('12,5', number)).toEqual({ value: 12.5 });
    expect(importCellValue('1.234,56', number)).toEqual({ value: 1234.56 });
    expect(importCellValue('1,234.56', number)).toEqual({ value: 1234.56 });
    expect(importCellValue('1.234.567', number)).toEqual({ value: 1234567 });
    expect(importCellValue(' 89,90 € ', price)).toEqual({ value: 89.9 });
    expect(importCellValue('-3', number)).toEqual({ value: -3 });
    expect(importCellValue('12 uds', number)).toEqual({ error: 'invalid' });
  });

  it('reads ISO and day/month/year dates, and only real ones', () => {
    expect(importCellValue('2026-10-01', date)).toEqual({
      value: '2026-10-01',
    });
    expect(importCellValue('1/10/2026', date)).toEqual({ value: '2026-10-01' });
    expect(importCellValue('31.12.2026', date)).toEqual({
      value: '2026-12-31',
    });
    expect(importCellValue('31/02/2026', date)).toEqual({ error: 'invalid' });
    expect(importCellValue('mañana', date)).toEqual({ error: 'invalid' });
  });

  it('reads yes/no words and matches choices ignoring case', () => {
    expect(importCellValue('Sí', flag)).toEqual({ value: true });
    expect(importCellValue('no', flag)).toEqual({ value: false });
    expect(importCellValue('quizá', flag)).toEqual({ error: 'invalid' });
    expect(importCellValue('disponible', status)).toEqual({
      value: 'Disponible',
    });
    expect(importCellValue('Agotado', status)).toEqual({
      error: 'unknownChoice',
    });
  });

  it('keeps blanks empty and undoes the formula guard of our export', () => {
    expect(importCellValue('   ', number)).toEqual({ value: null });
    expect(importCellValue("'=SUM(A1)", text)).toEqual({ value: '=SUM(A1)' });
    expect(importCellValue("'Rock'n'roll", text)).toEqual({
      value: "'Rock'n'roll",
    });
  });
});
