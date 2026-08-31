import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fecha = '2026-08-16';

test('genera preheader y badge de sueldo desde el resumen', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-generador-'));
  const edicion = path.join(tmp, 'ediciones', fecha);

  try {
    await mkdir(edicion, { recursive: true });
    await writeFile(path.join(tmp, 'template.html'), await readFile(path.join(raiz, 'template.html')));
    await writeFile(path.join(edicion, 'resumen.md'), await readFile(path.join(raiz, 'ediciones', fecha, 'resumen.md')));
    execFileSync('node', ['scripts/generar_newsletter.mjs', fecha], {
      cwd: raiz,
      env: { ...process.env, SEMANARIO_ROOT: tmp },
      stdio: 'pipe',
    });
    const html = await readFile(path.join(edicion, 'newsletter.html'), 'utf8');

    assert.match(html, /627 mensajes, 309 pegas nuevas y miércoles 12 como día más activo/);
    assert.match(html, /background-color:#143322[^>]*>12,5k–16,5k\/mes<\/span>/);
    assert.doesNotMatch(html, /{{[A-Z_]+}}/);
    assert.doesNotMatch(html, /Un vistazo a la conversación/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('renderiza destacados con cita textual y conserva el conteo', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-notables-'));
  const fechaNotable = '2099-01-16';
  const edicion = path.join(tmp, 'ediciones', fechaNotable);

  try {
    await mkdir(edicion, { recursive: true });
    await writeFile(path.join(tmp, 'template.html'), await readFile(path.join(raiz, 'template.html')));
    await writeFile(path.join(edicion, 'resumen.md'), `# Semanario de prueba\n\n## Actividad de la comunidad\n\n- **468 mensajes** publicados en los canales de contenido.\n- **Viernes 16** fue el día más activo, con **10 mensajes**.\n\n## Pegas\n\nDurante la semana se publicaron **2 pegas nuevas**.\n\n## Más notables\n\n### Vuelven los límites de cinco horas para Codex\n\n> “Tomorrow we will bring back the 5h limit for Plus accounts across ChatGPT Work and Codex.”\n\n*Traducción editorial:* El límite vuelve para cuentas Plus.\n\n\`gmq\` compartió la noticia. [Leer el artículo](https://example.com/codex).\n\n## #anuncios\n\n- Novedades.\n\n## Links de la semana\n\n### #ai\n\n- Se compartió Codex. [Leer](https://example.com/codex).\n`);

    execFileSync('node', ['scripts/generar_newsletter.mjs', fechaNotable], {
      cwd: raiz,
      env: { ...process.env, SEMANARIO_ROOT: tmp, SITE_URL: 'https://preview.example' },
      stdio: 'pipe',
    });
    const html = await readFile(path.join(edicion, 'newsletter.html'), 'utf8');

    assert.match(html, /468 mensajes, 2 pegas nuevas y viernes 16 como día más activo/);
    assert.match(html, /★ Más notable/);
    assert.match(html, /Tomorrow we will bring back the 5h limit for Plus accounts across ChatGPT Work and Codex/);
    assert.match(html, /Traducción editorial/);
    assert.match(html, /href="https:\/\/example\.com\/codex"/);
    assert.doesNotMatch(html, /{{[A-Z_]+}}/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
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

test('renderiza proyecto y despedida antes del footer sin firma', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-cierre-'));
  const fechaCierre = '2099-01-09';
  const edicion = path.join(tmp, 'ediciones', fechaCierre);

  try {
    await mkdir(edicion, { recursive: true });
    await writeFile(path.join(tmp, 'template.html'), await readFile(path.join(raiz, 'template.html')));
    await writeFile(path.join(edicion, 'resumen.md'), `# Semanario de prueba\n\n## Actividad de la comunidad\n\n- **2 mensajes** publicados en los canales de contenido.\n- **Viernes 9** fue el día más activo, con **2 mensajes**.\n\n## Pegas\n\nDurante la semana se publicó **1 pega nueva**.\n\n## Links de la semana\n\n### #comunidad\n\n- Se compartió un proyecto. [Ver proyecto](https://example.com/proyecto).\n\n<!-- SEMANARIO_CIERRE\nproyecto_link: https://showcase.devschile.cl/\nproyecto_titulo: showcase.devschile.cl\nproyecto_descripcion: Portafolio de proyectos personales y emprendimientos de usuarios devsChile.\ndespedida: Nos leemos la próxima semana.\n-->\n`);

    execFileSync('node', ['scripts/generar_newsletter.mjs', fechaCierre], {
      cwd: raiz,
      env: { ...process.env, SEMANARIO_ROOT: tmp, SITE_URL: 'https://preview.example' },
      stdio: 'pipe',
    });
    const html = await readFile(path.join(edicion, 'newsletter.html'), 'utf8');
    const proyecto = html.indexOf('showcase.devschile.cl');
    const despedida = html.indexOf('Nos leemos la próxima semana.');
    const footer = html.indexOf('FOOTER — no tocar');

    assert.ok(proyecto > -1 && proyecto < despedida, 'el proyecto debe preceder a la despedida');
    assert.ok(despedida < footer, 'la despedida debe quedar antes del footer');
    assert.doesNotMatch(html, /Firma caligráfica|firmas-fundadores/);
    assert.doesNotMatch(html, /{{[A-Z_]+}}/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('ubica el screenshot y el notable bajo sus canales, sin duplicar items', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-placements-'));
  const edicion = path.join(tmp, 'ediciones', '2026-08-30');

  try {
    await mkdir(edicion, { recursive: true });
    await writeFile(path.join(tmp, 'template.html'), await readFile(path.join(raiz, 'template.html')));
    await writeFile(path.join(edicion, 'resumen.md'), await readFile(path.join(raiz, 'ediciones', '2026-08-30', 'resumen.md')));
    execFileSync('node', ['scripts/generar_newsletter.mjs', '2026-08-30'], {
      cwd: raiz,
      env: { ...process.env, SEMANARIO_ROOT: tmp, SITE_URL: 'https://preview.example' },
      stdio: 'pipe',
    });
    const html = await readFile(path.join(edicion, 'newsletter.html'), 'utf8');
    const ai = html.indexOf('>#ai</span>');
    const notable = html.indexOf('Vuelven los límites de cinco horas para Codex');
    const lifehacks = html.indexOf('>#lifehacks</span>');
    const screenshot = html.indexOf('👀 Un vistazo a la conversación');
    const footer = html.indexOf('FOOTER — no tocar');

    assert.ok(ai > -1 && ai < notable, 'el notable debe quedar bajo #ai');
    assert.ok(lifehacks > -1 && lifehacks < screenshot, 'el screenshot debe quedar bajo #lifehacks');
    assert.ok(screenshot < html.indexOf('Openlogi', screenshot), 'el screenshot debe preceder a los items restantes de #lifehacks');
    assert.ok(notable < html.indexOf('DataCamp', notable), 'el notable debe preceder a los items restantes de #ai');
    assert.equal([...html.matchAll(/👀 Un vistazo a la conversación/g)].length, 1);
    assert.equal([...html.matchAll(/★ Más notable/g)].length, 1);
    assert.doesNotMatch(html, /`gmq` compartió una nota sobre los límites de uso de Codex/);
    assert.doesNotMatch(html, /`asilva` abrió una conversación sobre un escritorio eléctrico/);
    assert.ok(screenshot < footer && notable < footer, 'ambos bloques deben quedar antes del footer');
    assert.doesNotMatch(html, /{{[A-Z_]+}}/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
