import { columnDefinitionSchema, type TableColumn } from '@tablaria/shared';
import ExcelJS from 'exceljs';
import { toXlsx } from './record-export-xlsx';

function column(id: string, definition: object): TableColumn {
  return {
    ...columnDefinitionSchema.parse(definition),
    id,
    position: 0,
    createdAt: '',
    updatedAt: '',
  };
}

describe('toXlsx', () => {
  it('keeps numbers, prices and dates as Excel types, and text as text', async () => {
    const columns = [
      column('name', { name: 'Producto', type: 'text' }),
      column('price', {
        name: 'Precio',
        type: 'currency',
        options: { currency: 'EUR' },
      }),
      column('stock', { name: 'Stock', type: 'number' }),
      column('bought', { name: 'Comprado', type: 'date' }),
      column('active', { name: 'Activo', type: 'boolean' }),
    ];
    const buffer = await toXlsx('Ferretería: López/Norte', columns, [
      {
        name: '=HYPERLINK("http://example.com")',
        price: 89.9,
        stock: 14,
        bought: '2026-03-14',
        active: true,
      },
      { name: 'Sierra' },
    ]);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(buffer).buffer);
    const sheet = workbook.worksheets[0];
    // Characters Excel refuses in a sheet name are replaced.
    expect(sheet.name).toBe('Ferretería  López Norte');
    expect(sheet.getRow(1).values).toEqual([
      undefined,
      'Producto',
      'Precio (EUR)',
      'Stock',
      'Comprado',
      'Activo',
    ]);
    const row = sheet.getRow(2);
    // Text that looks like a formula stays text: it never runs in Excel.
    expect(row.getCell(1).type).toBe(ExcelJS.ValueType.String);
    expect(row.getCell(1).value).toBe('=HYPERLINK("http://example.com")');
    expect(row.getCell(2).value).toBe(89.9);
    expect(row.getCell(2).numFmt).toBe('#,##0.00 "€"');
    expect(row.getCell(3).value).toBe(14);
    expect(row.getCell(4).value).toEqual(new Date('2026-03-14T00:00:00.000Z'));
    expect(row.getCell(4).numFmt).toBe('dd/mm/yyyy');
    expect(row.getCell(5).value).toBe('Sí');
    // Empty cells stay empty.
    expect(sheet.getRow(3).getCell(2).value).toBeNull();
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
  });
});
