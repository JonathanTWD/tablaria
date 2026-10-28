import { columnDefinitionSchema, type TableColumn } from '@wisedata/shared';
import { exportFileName, toCsv } from './record-export';

const BOM = String.fromCharCode(0xfeff);

function column(id: string, definition: object): TableColumn {
  return {
    ...columnDefinitionSchema.parse(definition),
    id,
    position: 0,
    createdAt: '',
    updatedAt: '',
  };
}

const name = column('n', { name: 'Producto', type: 'text' });
const price = column('p', {
  name: 'Precio',
  type: 'currency',
  options: { currency: 'EUR' },
});
const active = column('a', { name: 'Activo', type: 'boolean' });
const since = column('s', { name: 'Alta', type: 'date' });

describe('toCsv', () => {
  it('writes a header and one line per record, ready for Excel in Spanish', () => {
    const csv = toCsv(
      [name, price, active, since],
      [
        { n: 'Taladro', p: 89.9, a: true, s: '2026-01-10' },
        { n: 'Sierra', a: false },
      ],
    );

    expect(csv).toBe(
      `${BOM}Producto;Precio (EUR);Activo;Alta\r\nTaladro;89,9;Sí;2026-01-10\r\nSierra;;No;\r\n`,
    );
  });

  it('quotes separators, quotes, line breaks and edge spaces', () => {
    const csv = toCsv(
      [name],
      [
        { n: 'Caja; 4×40' },
        { n: 'Llave "inglesa"' },
        { n: 'dos\nlíneas' },
        { n: ' hueco' },
        { n: 'Cinta, 5 m' },
      ],
    );

    expect(csv.split('\r\n').slice(1, 6)).toEqual([
      '"Caja; 4×40"',
      '"Llave ""inglesa"""',
      '"dos\nlíneas"',
      '" hueco"',
      'Cinta, 5 m',
    ]);
  });

  it('never lets a cell or column name run as a spreadsheet formula', () => {
    const formula = column('f', { name: '=SUM(A1)', type: 'text' });
    const csv = toCsv(
      [formula],
      [{ f: '=HYPERLINK("http://x")' }, { f: '+1' }, { f: '@cmd' }],
    );

    expect(csv.split('\r\n').slice(0, 4)).toEqual([
      `${BOM}'=SUM(A1)`,
      '"\'=HYPERLINK(""http://x"")"',
      "'+1",
      "'@cmd",
    ]);
  });

  it('keeps negative numbers as numbers', () => {
    const stock = column('q', { name: 'Ajuste', type: 'number' });
    expect(toCsv([stock], [{ q: -3.5 }])).toContain('\r\n-3,5\r\n');
  });
});

describe('exportFileName', () => {
  it('turns the table name into a dated ASCII slug', () => {
    const date = new Date('2026-10-28T12:00:00Z');
    expect(exportFileName('Ferretería López', 'csv', date)).toBe(
      'ferreteria-lopez-2026-10-28.csv',
    );
    expect(exportFileName('¿¿??', 'csv', date)).toBe('tabla-2026-10-28.csv');
  });
});
