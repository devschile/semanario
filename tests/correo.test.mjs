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

async function generar(script) {
  const raiz = await mkdtemp(path.join(os.tmpdir(), 'correo-'));
  const destino = path.join(raiz, 'ediciones', FECHA);
  await mkdir(destino, { recursive: true });
  await cp(path.join(raizRepo, 'template-propuesta.html'), path.join(raiz, 'template-propuesta.html'));
  for (const archivo of ['resumen.md', 'propuesta.json']) {
    await cp(path.join(raizRepo, 'ediciones', FECHA, archivo), path.join(destino, archivo));
  }
  await cp(path.join(raizRepo, 'ediciones', FECHA, 'assets-propuesta'), path.join(destino, 'assets-propuesta'), { recursive: true });
  await correr(process.execPath, [path.join(raizRepo, 'scripts', script), FECHA], {
    env: { ...process.env, SEMANARIO_ROOT: raiz, ASSETS_BASE: '' },
  });
  return { raiz, destino };
}

/** Mismo reemplazo que hace scripts/enviar.mjs, para mirar el correo final. */
function inyectar(html) {
  return html
    .replace(/<!--\s*VER_HTML\s*-->/g, '<a href="https://semanario.devschile.cl/newsletter/2026-11-15/">Ver la versión web →</a>')
    .replace(/<!--\s*BAJA_LINK[\s\S]*?-->/g, '· <a href="https://semanario.devschile.cl/api/baja?token=x">Darse de baja en un clic</a>');
}

test('generar_correo: arma el correo v2 con asunto, assets y links medibles', async () => {
  const { raiz, destino } = await generar('generar_correo.mjs');
  const html = await readFile(path.join(destino, 'newsletter.html'), 'utf8');
  const texto = await readFile(path.join(destino, 'correo.txt'), 'utf8');

  // Asunto: enviar.mjs y build.mjs sacan el rango de «edición del …».
  const titulo = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim() ?? '';
  assert.match(titulo, /edición del 9 al 15 de noviembre de 2026$/);

  // Maqueta aprobada, sin marcadores pendientes
  assert.doesNotMatch(html, /{{[A-Z_]+}}/, 'no deben quedar marcadores de plantilla');
  for (const bloque of ['Lo más comentado', 'Destacado de la comunidad', 'Proyectos de la comunidad', 'También sonaron', 'Pegas de la semana']) {
    assert.ok(html.includes(bloque), `falta el bloque «${bloque}»`);
  }
  assert.ok(html.includes('Dr. M. Barros Borgoño 71'), 'dirección legal intacta');

  // Pie: los dos marcadores que rellena enviar.mjs
  assert.ok(html.includes('<!--VER_HTML-->'), 'falta el marcador de versión web');
  assert.ok(html.includes('<!-- BAJA_LINK -->'), 'falta el marcador de baja');
  const final = inyectar(html);
  assert.ok(final.includes('Ver la versión web'), 'el link a la versión web no se inyecta');
  assert.ok(final.includes('Darse de baja en un clic'), 'el link de baja no se inyecta');
  assert.ok(!/semanario\.devschile\.cl[^<]*·\s*·/.test(final), 'el pie no debe dejar «· ·»');
  assert.doesNotMatch(final, /<!--(VER_HTML| BAJA_LINK)/, 'no deben quedar marcadores en el correo final');

  // Assets absolutos de producción y links con utm_source
  const srcs = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
  assert.ok(srcs.length >= 9, `esperaba imágenes, hay ${srcs.length}`);
  for (const src of srcs) {
    assert.match(src, /^https:\/\/semanario\.devschile\.cl\/newsletter\/2026-11-15\/assets-propuesta\//, `asset relativo o de otro origen: ${src}`);
  }
  const externos = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(externos.length >= 30, `esperaba al menos 30 links, hay ${externos.length}`);
  for (const href of externos) assert.match(href, /[?&](amp;)?utm_source=semanario_devschile($|&)/, `link sin utm_source: ${href}`);

  // Alternativa texto: mismo contenido, sin markdown ni handles sueltos
  assert.match(texto, /SEMANARIO devsChile — #\d+ · 9 al 15 de noviembre de 2026/);
  assert.ok(!texto.includes('**'), 'la versión texto no debe llevar markdown');
  assert.match(texto, /LO MÁS COMENTADO/);
  assert.match(texto, /Nos leemos la próxima semana\./);

  await rm(raiz, { recursive: true, force: true });
});

test('generar_propuesta: la página web no expone links de baja ni de versión web', async () => {
  const { raiz, destino } = await generar('generar_propuesta.mjs');
  const html = await readFile(path.join(destino, 'propuesta.html'), 'utf8');
  assert.ok(!html.includes('<!--VER_HTML-->'), 'la web no lleva marcador de versión web');
  assert.ok(!html.includes('/api/baja'), 'la web no lleva link de baja');
  assert.doesNotMatch(html, /utm_source=semanario_devschile/, 'la web no debe llevar UTM');
  await rm(raiz, { recursive: true, force: true });
});
