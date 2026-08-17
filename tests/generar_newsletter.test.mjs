import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fecha = '2026-08-16';

test('genera preheader y badge de sueldo desde el resumen', async () => {
  execFileSync('node', ['scripts/generar_newsletter.mjs', fecha], { cwd: raiz, stdio: 'pipe' });
  const html = await readFile(path.join(raiz, 'ediciones', fecha, 'newsletter.html'), 'utf8');

  assert.match(html, /627 mensajes, 309 pegas nuevas y miércoles 12 como día más activo/);
  assert.match(html, /background-color:#143322[^>]*>12,5k–16,5k\/mes<\/span>/);
  assert.doesNotMatch(html, /{{[A-Z_]+}}/);
});
