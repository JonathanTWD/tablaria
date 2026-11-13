import { toPlainText } from './plain-text';

describe('toPlainText', () => {
  it('drops bold, inline code and heading marks', () => {
    expect(
      toPlainText(
        '## Resumen\nEl proveedor con más productos es **Fijaciones Levante**.',
      ),
    ).toBe('Resumen\nEl proveedor con más productos es Fijaciones Levante.');
    expect(toPlainText('Usa la referencia `TL-750` o __AT-012__.')).toBe(
      'Usa la referencia TL-750 o AT-012.',
    );
  });

  it('keeps single asterisks and underscores that belong to the data', () => {
    expect(toPlainText('REF_01 cuesta 5 * 3 €; #3 en la lista.')).toBe(
      'REF_01 cuesta 5 * 3 €; #3 en la lista.',
    );
  });
});
