import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

const correr = promisify(execFile);
const raizRepo = path.resolve(import.meta.dirname, '..');
const FECHA = '2026-11-15';

test('generar_propuesta: renderiza la edición sin nombres de personas', async () => {
  const raiz = await mkdtemp(path.join(os.tmpdir(), 'propuesta-'));
  const destino = path.join(raiz, 'ediciones', FECHA);
  await mkdir(destino, { recursive: true });
  await cp(path.join(raizRepo, 'template-propuesta.html'), path.join(raiz, 'template-propuesta.html'));
  for (const archivo of ['resumen.md', 'propuesta.json']) {
    await cp(path.join(raizRepo, 'ediciones', FECHA, archivo), path.join(destino, archivo));
  }
  await cp(path.join(raizRepo, 'ediciones', FECHA, 'assets-propuesta'), path.join(destino, 'assets-propuesta'), { recursive: true });

  await correr(process.execPath, [path.join(raizRepo, 'scripts', 'generar_propuesta.mjs'), FECHA], {
    env: { ...process.env, SEMANARIO_ROOT: raiz, ASSETS_BASE: '' },
  });

  const html = await readFile(path.join(destino, 'propuesta.html'), 'utf8');

  // Maqueta completa
  assert.doesNotMatch(html, /{{[A-Z_]+}}/, 'no deben quedar marcadores');
  assert.ok(html.includes('Lo más relevante'));
  assert.ok(html.includes('También sonaron'));
  assert.ok(html.includes('Pegas de la semana'));
  assert.ok(html.includes('Dr. M. Barros Borgoño 71'), 'dirección legal intacta');
  assert.ok(html.includes('BAJA_LINK'), 'marcador de baja intacto');

  // Editorial: el foco son los links, no quién los compartió
  const datos = JSON.parse(await readFile(path.join(destino, 'propuesta.json'), 'utf8'));
  assert.doesNotMatch(html, /`[a-z0-9._]+`/, 'sin handles en backticks');
  for (const persona of ['jorgeepunan', 'electricmonk', 'arveja', 'keldor', 'iarodriguezch']) {
    assert.ok(!html.includes(persona), `no debe aparecer el usuario ${persona}`);
  }

  // Los temas salen del JSON, no del canal, y los links están presentes
  for (const seccion of datos.secciones) assert.ok(html.includes(seccion.tema), `falta el tema ${seccion.tema}`);
  const hrefs = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(hrefs.length >= 30, `esperaba al menos 30 links, hay ${hrefs.length}`);

  await rm(raiz, { recursive: true, force: true });
});
