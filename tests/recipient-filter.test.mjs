import assert from 'node:assert/strict';
import test from 'node:test';
import { filtrarDestinatarios } from '../scripts/lib/recipient-filter.mjs';

test('filtra destinatarios solicitados sin cambiar mayúsculas ni orden', () => {
  const lista = [
    { email: 'uno@ejemplo.cl' },
    { email: 'Dos@ejemplo.cl' },
    { email: 'tres@ejemplo.cl' },
  ];

  assert.deepEqual(
    filtrarDestinatarios(lista, 'dos@ejemplo.cl, uno@ejemplo.cl, ausente@ejemplo.cl'),
    [{ email: 'uno@ejemplo.cl' }, { email: 'Dos@ejemplo.cl' }],
  );
});

test('sin filtro conserva toda la lista', () => {
  const lista = [{ email: 'uno@ejemplo.cl' }];
  assert.deepEqual(filtrarDestinatarios(lista, ''), lista);
});
