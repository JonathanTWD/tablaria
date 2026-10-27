import {
  type ColumnDefinition,
  columnDefinitionSchema,
} from '@wisedata/shared';
import { convertCellValue } from './convert-value';

function column(definition: object): ColumnDefinition {
  return columnDefinitionSchema.parse({ name: 'Column', ...definition });
}

const text = column({ type: 'text' });
const number = column({ type: 'number' });
const date = column({ type: 'date' });
const boolean = column({ type: 'boolean' });
const status = column({
  type: 'select',
  options: {
    choices: [
      { id: 'a', label: 'En uso', color: 'green' },
      { id: 'b', label: 'De baja', color: 'red' },
    ],
  },
});

describe('convertCellValue', () => {
  it('turns any scalar into trimmed text', () => {
    expect(convertCellValue(12.5, text)).toBe('12.5');
    expect(convertCellValue(true, text)).toBe('true');
    expect(convertCellValue('  hola ', text)).toBe('hola');
    expect(convertCellValue('   ', text)).toBeNull();
  });

  it('parses numbers written with a dot or a comma', () => {
    expect(convertCellValue('42', number)).toBe(42);
    expect(convertCellValue(' -3,75 ', number)).toBe(-3.75);
    expect(convertCellValue('1.5', number)).toBe(1.5);
    expect(convertCellValue('12 cajas', number)).toBeNull();
    expect(convertCellValue(true, number)).toBeNull();
  });

  it('keeps only valid ISO dates', () => {
    expect(convertCellValue('2026-02-28', date)).toBe('2026-02-28');
    expect(convertCellValue('2026-02-30', date)).toBeNull();
    expect(convertCellValue('28/02/2026', date)).toBeNull();
    expect(convertCellValue(20260228, date)).toBeNull();
  });

  it('reads common yes/no words as booleans', () => {
    expect(convertCellValue('Sí', boolean)).toBe(true);
    expect(convertCellValue('x', boolean)).toBe(true);
    expect(convertCellValue('NO', boolean)).toBe(false);
    expect(convertCellValue(0, boolean)).toBe(false);
    expect(convertCellValue('quizás', boolean)).toBeNull();
  });

  it('matches select choices ignoring case and spacing', () => {
    expect(convertCellValue(' en uso ', status)).toBe('En uso');
    expect(convertCellValue('Reparación', status)).toBeNull();
    expect(convertCellValue(3, status)).toBeNull();
  });
});
