import {
  checkFormula,
  evaluateFormula,
  FormulaError,
  type FormulaColumnType,
  type FormulaValue,
  parseFormula,
  renameFormulaColumns,
} from '@tablaria/shared';
import type { RecordColumn, RecordData } from '@tablaria/shared';
import { fillFormulas } from './formulas';

const TYPES: Record<string, FormulaColumnType> = {
  Precio: 'number',
  Stock: 'number',
  Nombre: 'text',
  Caduca: 'date',
  Activo: 'boolean',
  Proveedor: null,
};

function typeOf(expression: string) {
  return checkFormula(parseFormula(expression), (ref) => TYPES[ref]);
}

function run(expression: string, values: Record<string, FormulaValue> = {}) {
  return evaluateFormula(
    parseFormula(expression),
    (ref) => values[ref] ?? null,
    '2026-11-04',
  );
}

function errorOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof FormulaError) {
      return error.code;
    }
    throw error;
  }
  throw new Error('No error');
}

describe('formulas', () => {
  describe('parsing and types', () => {
    it.each([
      ['{Precio} * {Stock}', 'number'],
      ['-{Precio} + 2 * 3', 'number'],
      ['{Nombre} & " (" & {Stock} & ")"', 'text'],
      ['SI({Stock} < 5, "Pedir", "OK")', 'text'],
      ['if({Stock} < 5; "Pedir")', 'text'],
      ['Y({Activo}, NO(ESVACIO({Nombre})))', 'boolean'],
      ['DIAS({Caduca}, HOY())', 'number'],
      ['REDONDEAR({Precio} / 3, 2)', 'number'],
      ['{Precio} = 2', 'boolean'],
      ['VERDADERO', 'boolean'],
    ])('%s gives a %s', (expression, type) => {
      expect(typeOf(expression)).toBe(type);
    });

    it.each([
      ['', 'empty'],
      ['{Precio} *', 'unexpected'],
      ['{Precio', 'unclosedColumn'],
      ['"hola', 'unclosedText'],
      ['SUMAR(1)', 'unknownFunction'],
      ['SI(VERDADERO)', 'arguments'],
      ['{Precio} < 1 < 2', 'unexpected'],
      ['{Coste} * 2', 'unknownColumn'],
      ['{Proveedor} & ""', 'columnNotAllowed'],
      ['{Nombre} * 2', 'types'],
      ['SI({Activo}, 1, "uno")', 'types'],
      ['{Activo} & "x"', 'types'],
      ['1' + ' + 1'.repeat(100), 'tooComplex'],
      ['1'.repeat(1001), 'tooLong'],
    ])('rejects %s (%s)', (expression, code) => {
      expect(errorOf(() => typeOf(expression))).toBe(code);
    });

    it('lets an unknown type fit anything', () => {
      expect(checkFormula(parseFormula('{X} * 2'), () => 'unknown')).toBe(
        'number',
      );
    });
  });

  describe('evaluation', () => {
    it.each([
      ['{Precio} * {Stock}', { Precio: 2.5, Stock: 4 }, 10],
      ['0.1 + 0.2', {}, 0.3],
      // A decimal comma, as written in Spanish, unless `;` or a space separates.
      ['MAX(2,5; 1)', {}, 2.5],
      ['MAX(2, 5)', {}, 5],
      ['{Precio} * {Stock}', { Precio: 2.5 }, null],
      ['10 / 0', {}, null],
      ['{Nombre} & "!"', {}, '!'],
      ['{Nombre} & ""', {}, null],
      ['SI({Stock} < 5, "Pedir", "OK")', { Stock: 3 }, 'Pedir'],
      ['SI({Stock} < 5, "Pedir", "OK")', {}, 'OK'],
      ['SI({Stock} < 5, "Pedir")', { Stock: 9 }, null],
      ['{Nombre} = "tornillo"', { Nombre: 'Tornillo' }, true],
      ['{Nombre} = ""', {}, false],
      ['ESVACIO({Nombre})', {}, true],
      ['DIAS({Caduca}, HOY())', { Caduca: '2026-11-14' }, 10],
      ['REDONDEAR(2 / 3, 2)', {}, 0.67],
      ['MAX({Precio}, 3, {Stock})', { Precio: 7 }, 7],
      ['MAYUSC("ñandú")', {}, 'ÑANDÚ'],
      ['LARGO({Nombre})', { Nombre: 'Peña' }, 4],
      ['"Dice ""hola"""', {}, 'Dice "hola"'],
    ])('%s with %j is %j', (expression, values, expected) => {
      expect(run(expression, values)).toBe(expected);
    });
  });

  it('reads a doubled brace as part of the column name', () => {
    const node = parseFormula('{Talla {EU}}} & ""');
    expect(
      evaluateFormula(node, (ref) => (ref === 'Talla {EU}' ? '42' : null), ''),
    ).toBe('42');
    expect(renameFormulaColumns('{x}', () => 'Talla {EU}')).toBe(
      '{Talla {EU}}}',
    );
  });

  it('renames the columns between braces and leaves quoted text alone', () => {
    const ids: Record<string, string> = { Precio: 'p1', Stock: 's1' };
    expect(
      renameFormulaColumns('{Precio}*{ Stock } & "{Precio}" & {Otro}', (ref) =>
        ref in ids ? ids[ref] : undefined,
      ),
    ).toBe('{p1}*{s1} & "{Precio}" & {Otro}');
  });

  it('fills each record with its result and leaves empty results out', () => {
    const columns = [
      { id: 'p', type: 'number' },
      {
        id: 'f',
        type: 'formula',
        options: {
          expression: '{p} * 2',
          currency: null,
          resultType: 'number',
        },
      },
    ] as RecordColumn[];
    const records: { data: RecordData }[] = [{ data: { p: 4 } }, { data: {} }];
    fillFormulas(columns, records);
    expect(records).toEqual([{ data: { p: 4, f: 8 } }, { data: {} }]);
  });
});
