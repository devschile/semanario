import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  assert.doesNotMatch(html, /Un vistazo a la conversación/);
});

test('renderiza la imagen de anuncios y un screenshot comunitario desde metadata', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-visuales-'));
  const fechaVisual = '2099-01-02';
  const edicion = path.join(tmp, 'ediciones', fechaVisual);

  try {
    await mkdir(edicion, { recursive: true });
    await writeFile(path.join(tmp, 'template.html'), await readFile(path.join(raiz, 'template.html')));
    await writeFile(path.join(edicion, 'resumen.md'), `# Semanario de prueba\n\n## Actividad de la comunidad\n\n- **2 mensajes** publicados en los canales de contenido.\n- **Sábado 2** fue el día más activo, con **2 mensajes**.\n\n## Pegas\n\nDurante la semana se publicaron **1 pega nueva**.\n\n## #anuncios\n\n- Hay novedades de la comunidad.\n\n## Links de la semana\n\n### #comunidad\n\n- Se compartió un proyecto. [Ver proyecto](https://example.com/proyecto).\n\n<!-- SEMANARIO_VISUALES\nanuncio: assets/anuncio-comunidad.png\nanuncio_alt: Ilustración del anuncio\nscreenshot: assets/screenshot-comunidad.png\nscreenshot_link: https://example.com/proyecto\nscreenshot_alt: Captura del proyecto\nscreenshot_caption: El hilo más comentado de la semana\n-->\n`);

    execFileSync('node', ['scripts/generar_newsletter.mjs', fechaVisual], {
      cwd: raiz,
      env: { ...process.env, SEMANARIO_ROOT: tmp, SITE_URL: 'https://preview.example' },
      stdio: 'pipe',
    });
    const html = await readFile(path.join(edicion, 'newsletter.html'), 'utf8');

    assert.match(html, /https:\/\/preview\.example\/newsletter\/2099-01-02\/assets\/anuncio-comunidad\.png/);
    assert.match(html, /https:\/\/preview\.example\/newsletter\/2099-01-02\/assets\/screenshot-comunidad\.png/);
    assert.match(html, /href="https:\/\/example\.com\/proyecto"/);
    assert.match(html, /Ilustración del anuncio/);
    assert.match(html, /El hilo más comentado de la semana/);
    assert.doesNotMatch(html, /{{[A-Z_]+}}/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
