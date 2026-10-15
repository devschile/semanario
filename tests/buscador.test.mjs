import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aplicarTags, extraerLinks, MAX_TAGS, urlSegura } from '../scripts/lib/indice-links.mjs';
import { buscar, contar, normalizar, prepararIndice } from '../js/buscar-core.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vocabulario = JSON.parse(await readFile(path.join(raiz, 'scripts', 'tags.json'), 'utf8'));

const RESUMEN = `# Semanario de prueba

## Actividad de la comunidad

- **10 mensajes**. En #ai se habló de [Zen](https://zen-browser.app/).

## Pegas

Se publicaron **2 pegas nuevas** en [pegas.devschile.cl](https://pegas.devschile.cl).

### Destacadas con sueldo visible

- **Backend — Acme**: USD 4.000/mes. [Postular](https://example.com/acme).

## Más notables

### Un hilo largo

> “Una cita textual.”

\`gmq\` compartió [la nota](https://example.com/nota).

## Links de la semana

<!-- SEMANARIO_VISUALES
banner: https://example.com/banner.png
-->

### #ai

- El martes \`dukuo\` compartió [PhotoCraft](https://github.com/storytold/photocraft), un clon de **Photoshop** en Rust.
- Repetido: [PhotoCraft otra vez](https://github.com/storytold/photocraft).
- Peligroso: [click](javascript:alert(1)).

### #juegos

- El jueves se habló del [Steam Deck](https://store.steampowered.com/steamdeck) y de [Código Retro](https://example.com/codigo-retro).

---

**Nota editorial:** se omitieron memes.
`;

test('extrae links por canal, sin duplicados, metadata ni URLs peligrosas', () => {
  const links = extraerLinks(RESUMEN);
  const urls = links.map((l) => l.url);

  assert.deepEqual(urls, [
    'https://zen-browser.app/',
    'https://example.com/acme',
    'https://example.com/nota',
    'https://github.com/storytold/photocraft',
    'https://store.steampowered.com/steamdeck',
    'https://example.com/codigo-retro',
  ]);
  assert.ok(!urls.includes('https://pegas.devschile.cl/'), 'el párrafo de conteo de pegas no se indexa');
  assert.ok(!urls.some((u) => u.includes('banner.png')), 'la metadata en comentarios no se indexa');

  const photo = links.find((l) => l.url.includes('photocraft'));
  assert.equal(photo.canal, '#ai');
  assert.equal(photo.titulo, 'PhotoCraft');
  assert.equal(photo.contexto, 'El martes dukuo compartió PhotoCraft, un clon de Photoshop en Rust.');

  assert.equal(links.find((l) => l.url.endsWith('/acme')).canal, '#trabajos');
  assert.equal(links.find((l) => l.url.endsWith('/nota')).canal, 'Más notables');
  assert.equal(links.find((l) => l.url.includes('zen')).canal, 'Actividad');
});

test('urlSegura solo deja pasar http(s)', () => {
  assert.equal(urlSegura('https://example.com'), 'https://example.com/');
  assert.equal(urlSegura('javascript:alert(1)'), null);
  assert.equal(urlSegura('data:text/html,hola'), null);
  assert.equal(urlSegura('no es url'), null);
});

test('aplicarTags solo toma tags del vocabulario, sin repetir y con tope', () => {
  const links = extraerLinks(RESUMEN);
  const { links: conTags, avisos } = aplicarTags(links, {
    links: [
      { url: 'https://github.com/storytold/photocraft', tags: ['diseno', 'open-source', 'inventado', 'diseno', 'ia', 'herramientas', 'lenguajes'] },
      // Una URL que no está en el resumen no puede colarse al índice.
      { url: 'https://malicioso.example/', tags: ['ia'] },
    ],
  }, vocabulario);

  assert.equal(conTags.length, links.length);
  assert.ok(!conTags.some((l) => l.url.includes('malicioso')));
  const photo = conTags.find((l) => l.url.includes('photocraft'));
  assert.deepEqual(photo.tags, ['diseno', 'open-source', 'ia', 'herramientas'].slice(0, MAX_TAGS));
  assert.match(avisos.join('\n'), /inventado/);
  assert.deepEqual(conTags.find((l) => l.url.includes('zen')).tags, []);
});

test('buscar ignora tildes y mayúsculas, filtra por canal y tag', () => {
  const { links } = aplicarTags(extraerLinks(RESUMEN), {
    links: [{ url: 'https://store.steampowered.com/steamdeck', tags: ['juegos', 'hardware'] }],
  }, vocabulario);
  const indice = prepararIndice({
    tags: vocabulario,
    ediciones: [{ fecha: '2099-01-02', numero: 1, rango: 'x', legible: '2 ene 2099' }],
    links: [
      ...links.map((l) => ({ ...l, edicion: '2099-01-02' })),
      { url: 'javascript:alert(1)', titulo: 'xss', canal: '#ai', contexto: '', tags: [], edicion: '2099-01-02' },
    ],
  });

  assert.equal(normalizar('Código RETRO'), 'codigo retro');
  assert.ok(!indice.links.some((l) => l.titulo === 'xss'), 'el cliente también descarta URLs no http(s)');

  // Los dos links comparten viñeta (y contexto); el que calza en el título va primero.
  assert.deepEqual(buscar(indice, { q: 'codigo' }).map((l) => l.titulo), ['Código Retro', 'Steam Deck']);
  assert.deepEqual(buscar(indice, { q: 'photoshop rust' }).map((l) => l.titulo), ['PhotoCraft']);
  assert.equal(buscar(indice, { q: 'photoshop python' }).length, 0);
  assert.deepEqual(buscar(indice, { canal: '#juegos' }).map((l) => l.titulo).sort(), ['Código Retro', 'Steam Deck']);
  assert.deepEqual(buscar(indice, { tag: 'hardware' }).map((l) => l.titulo), ['Steam Deck']);
  // El nombre visible del tag también se busca como texto.
  assert.deepEqual(buscar(indice, { q: 'gadgets' }).map((l) => l.titulo), ['Steam Deck']);
  assert.deepEqual(contar(indice.links, 'tags'), [['hardware', 1], ['juegos', 1]]);
});

test('el build publica buscar.json con los tags de links.json', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-buscador-'));
  const fecha = '2099-01-02';
  const edicion = path.join(tmp, 'ediciones', fecha);

  try {
    await mkdir(edicion, { recursive: true });
    await writeFile(path.join(tmp, 'index.html'), '<main><!-- build:ediciones --><!-- /build:ediciones --></main>');
    await writeFile(
      path.join(edicion, 'newsletter.html'),
      '<title>Semanario devsChile — edición del 28 dic 2098 – 2 ene 2099</title>'
        + '<div style="display:none">📰 Semanario devsChile — prueba</div>',
    );
    await writeFile(path.join(edicion, 'resumen.md'), RESUMEN);
    await writeFile(path.join(edicion, 'links.json'), JSON.stringify({
      edicion: fecha,
      links: [{ url: 'https://github.com/storytold/photocraft', titulo: 'cambiado por el bot', tags: ['diseno'] }],
    }));

    execFileSync('node', ['scripts/build.mjs'], {
      cwd: raiz,
      env: { ...process.env, SEMANARIO_ROOT: tmp },
      stdio: 'pipe',
    });

    const indice = JSON.parse(await readFile(path.join(tmp, 'dist', 'buscar.json'), 'utf8'));
    const photo = indice.links.find((l) => l.url.includes('photocraft'));

    assert.equal(indice.links.length, 6);
    assert.equal(photo.titulo, 'PhotoCraft', 'el título sale del resumen, no de links.json');
    assert.deepEqual(photo.tags, ['diseno']);
    assert.equal(photo.edicion, fecha);
    assert.deepEqual(indice.ediciones, [{ fecha, numero: 1, rango: '28 dic 2098 – 2 ene 2099', legible: '2 ene 2099' }]);
    assert.equal(indice.tags.ia, vocabulario.ia);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
