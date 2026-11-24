import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  clasificarStatus,
  normalizarUrl,
  recolectarUrls,
  verificarUrl,
} from '../scripts/verificar_links.mjs';

test('normalizarUrl saca utm_*, hash y slash final', () => {
  assert.equal(
    normalizarUrl('https://sadservers.com/?utm_source=semanario_devschile#top'),
    'https://sadservers.com/',
  );
  assert.equal(
    normalizarUrl('https://ejemplo.cl/pagina/?utm_medium=mail'),
    'https://ejemplo.cl/pagina',
  );
});

test('clasificarStatus separa ok, bloqueado y roto', () => {
  assert.equal(clasificarStatus(200), 'ok');
  assert.equal(clasificarStatus(301), 'ok');
  assert.equal(clasificarStatus(403), 'bloqueado');
  assert.equal(clasificarStatus(429), 'bloqueado');
  assert.equal(clasificarStatus(404), 'roto');
  assert.equal(clasificarStatus(500), 'roto');
});

test('verificarUrl detecta respuestas vivas, bloqueadas y muertas', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/ok') { res.writeHead(200); res.end('hola'); return; }
    if (req.url === '/bloqueado') { res.writeHead(403); res.end('nope'); return; }
    if (req.url === '/muerto') { res.writeHead(404); res.end('nope'); return; }
    if (req.url === '/solo-get' && req.method === 'HEAD') { res.writeHead(405); res.end(); return; }
    if (req.url === '/solo-get') { res.writeHead(200); res.end('ok'); return; }
    res.writeHead(500); res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    assert.equal((await verificarUrl(`${base}/ok`)).estado, 'ok');
    assert.equal((await verificarUrl(`${base}/bloqueado`)).estado, 'bloqueado');
    assert.equal((await verificarUrl(`${base}/muerto`)).estado, 'roto');
    assert.equal((await verificarUrl(`${base}/solo-get`)).estado, 'ok');
    const caido = await verificarUrl('http://127.0.0.1:1/no-existe');
    assert.equal(caido.estado, 'roto');
    assert.equal(caido.status, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('recolectarUrls junta resumen.md y propuesta.json sin duplicados', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'semanario-links-'));
  await writeFile(path.join(dir, 'resumen.md'), [
    '- [Uno](https://ejemplo.cl/uno/) y [Dos](https://ejemplo.cl/dos)',
    '',
  ].join('\n'));
  await writeFile(path.join(dir, 'propuesta.json'), JSON.stringify({
    hero: { auspicio: { url: 'https://ejemplo.cl/uno/?utm_source=semanario_devschile' } },
    items: [{ url: 'https://ejemplo.cl/tres' }, { texto: 'sin link' }],
  }));

  const urls = await recolectarUrls(dir);
  const normalizadas = urls.map((u) => normalizarUrl(u.url));
  assert.equal(normalizadas.length, new Set(normalizadas).size);
  assert.deepEqual(
    normalizadas.sort(),
    ['https://ejemplo.cl/dos', 'https://ejemplo.cl/tres', 'https://ejemplo.cl/uno'].sort(),
  );
  assert.ok(urls.some((u) => u.origen === 'propuesta.json'));
});
