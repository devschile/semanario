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
    assert.doesNotMatch(html, /Anuncio de la comunidad:<\/strong>[ \t]+\n/);
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
    assert.match(html, /href="https:\/\/example\.com\/codex\?utm_source=semanario_devschile"/);
    assert.match(html, /<code>gmq<\/code> compartió la noticia/);
    assert.doesNotMatch(html, /`gmq`/);
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
    assert.match(html, /href="https:\/\/example\.com\/proyecto\?utm_source=semanario_devschile"/);
    assert.match(html, /Ilustración del anuncio/);
    assert.match(html, /El hilo más comentado de la semana/);
    assert.doesNotMatch(html, /{{[A-Z_]+}}/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('ubica el link destacado al inicio, antes de la semana en números', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-inicio-'));
  const fechaInicio = '2099-01-23';
  const edicion = path.join(tmp, 'ediciones', fechaInicio);

  try {
    await mkdir(edicion, { recursive: true });
    await writeFile(path.join(tmp, 'template.html'), await readFile(path.join(raiz, 'template.html')));
    await writeFile(path.join(edicion, 'resumen.md'), `# Semanario de prueba\n\n## Actividad de la comunidad\n\n- **5 mensajes** publicados en los canales de contenido.\n- **Viernes 23** fue el día más activo, con **3 mensajes**.\n\n## Pegas\n\nDurante la semana se publicaron **1 pega nueva**.\n\n## Links de la semana\n\n### #comunidad\n\n- Se compartió un directorio. [Ver directorio](https://example.com/trabajos).\n\n<!-- SEMANARIO_VISUALES\nscreenshot: assets/directorio-preview.jpg\nscreenshot_link: https://example.com/trabajos\nscreenshot_alt: Directorio de trabajos remotos con sueldos en USD\nscreenshot_etiqueta: 🔗 Link destacado\nscreenshot_caption: Ofertas remotas con el sueldo a la vista.\nscreenshot_canal: inicio\n-->\n`);

    execFileSync('node', ['scripts/generar_newsletter.mjs', fechaInicio], {
      cwd: raiz,
      env: { ...process.env, SEMANARIO_ROOT: tmp, SITE_URL: 'https://preview.example' },
      stdio: 'pipe',
    });
    const html = await readFile(path.join(edicion, 'newsletter.html'), 'utf8');
    const destacado = html.indexOf('Ofertas remotas con el sueldo a la vista.');
    const numeros = html.indexOf('La semana en números</h2>');

    assert.ok(destacado > -1, 'el link destacado debe estar en el HTML');
    assert.ok(destacado < numeros, 'el link destacado debe ir antes de la semana en números');
    assert.equal(html.split('Ofertas remotas con el sueldo a la vista.').length - 1, 1, 'no debe duplicarse en el slot general');
    assert.match(html, /href="https:\/\/example\.com\/trabajos\?utm_source=semanario_devschile"/);
    assert.match(html, /https:\/\/preview\.example\/newsletter\/2099-01-23\/assets\/directorio-preview\.jpg/);
    assert.match(html, /Link destacado/);
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

test('numera la edición y escribe el rango largo en el encabezado', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-encabezado-'));

  try {
    // Tres ediciones previas: la que se genera es la #4.
    for (const previa of ['2026-08-02', '2026-08-09', '2026-08-16']) {
      await mkdir(path.join(tmp, 'ediciones', previa), { recursive: true });
    }
    const fechaCabecera = '2026-09-13';
    const edicion = path.join(tmp, 'ediciones', fechaCabecera);
    await mkdir(edicion, { recursive: true });
    await writeFile(path.join(tmp, 'template.html'), await readFile(path.join(raiz, 'template.html')));
    await writeFile(path.join(edicion, 'resumen.md'), `# Semanario de prueba\n\n## Actividad de la comunidad\n\n- **9 mensajes** publicados en los canales de contenido.\n- **Viernes 11** fue el día más activo, con **4 mensajes**.\n\n## Pegas\n\nDurante la semana se publicaron **3 pegas nuevas**.\n\n## Links de la semana\n\n### #comunidad\n\n- Se compartió un proyecto. [Ver proyecto](https://example.com/proyecto).\n`);

    execFileSync('node', ['scripts/generar_newsletter.mjs', fechaCabecera], {
      cwd: raiz,
      env: { ...process.env, SEMANARIO_ROOT: tmp },
      stdio: 'pipe',
    });
    const html = await readFile(path.join(edicion, 'newsletter.html'), 'utf8');

    assert.match(html, /Edición <span[^>]*>#4<\/span> de la semana/);
    assert.match(html, /7 al 13 septiembre 2026/);
    // build.mjs saca el rango del <title> con /edición del (.+)$/ — no romperlo.
    assert.match(html, /<title>Semanario devsChile — edición del 7 al 13 septiembre 2026<\/title>/);
    assert.doesNotMatch(html, /{{[A-Z_]+}}/);
    assert.doesNotMatch(html, /Anuncio de la comunidad:<\/strong>[ \t]+\n/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('dibuja el banner una sola vez y solo si la edición lo declara', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-banner-'));
  const fechaBanner = '2099-02-06';
  const edicion = path.join(tmp, 'ediciones', fechaBanner);

  try {
    await mkdir(edicion, { recursive: true });
    await writeFile(path.join(tmp, 'template.html'), await readFile(path.join(raiz, 'template.html')));
    const base = `# Semanario de prueba\n\n## Actividad de la comunidad\n\n- **4 mensajes** publicados en los canales de contenido.\n- **Viernes 5** fue el día más activo, con **2 mensajes**.\n\n## Pegas\n\nDurante la semana se publicaron **2 pegas nuevas**.\n\n## Links de la semana\n\n### #comunidad\n\n- Se compartió un proyecto. [Ver proyecto](https://example.com/proyecto).\n`;

    // Sin metadata de banner no debe dibujarse nada.
    await writeFile(path.join(edicion, 'resumen.md'), base);
    execFileSync('node', ['scripts/generar_newsletter.mjs', fechaBanner], {
      cwd: raiz, env: { ...process.env, SEMANARIO_ROOT: tmp }, stdio: 'pipe',
    });
    assert.doesNotMatch(await readFile(path.join(edicion, 'newsletter.html'), 'utf8'), /Objetos devsChile/);

    await writeFile(path.join(edicion, 'resumen.md'), `${base}\n<!-- SEMANARIO_VISUALES\nbanner: https://cdn.example/tabla-01.jpg\nbanner_link: https://objetos.devschile.cl/?utm_source=semanario\nbanner_alt: TABLA / 01 de Objetos devsChile\nbanner_etiqueta: Objetos devsChile\n-->\n`);
    execFileSync('node', ['scripts/generar_newsletter.mjs', fechaBanner], {
      cwd: raiz, env: { ...process.env, SEMANARIO_ROOT: tmp }, stdio: 'pipe',
    });
    const html = await readFile(path.join(edicion, 'newsletter.html'), 'utf8');

    // Una sola vez: ningún comentario de la plantilla puede llevar el marcador
    // entre llaves, o el generador inyecta el bloque ahí adentro también.
    assert.equal([...html.matchAll(/cdn\.example\/tabla-01\.jpg/g)].length, 1);
    assert.match(html, /Objetos devsChile/);
    assert.match(html, /href="https:\/\/objetos\.devschile\.cl\/\?utm_source=semanario_devschile"/);

    // El banner va después de Pegas y antes del proyecto destacado.
    const pegas = html.indexOf('💼 Pegas');
    const banner = html.indexOf('cdn.example/tabla-01.jpg');
    const canales = html.indexOf('📌 Lo que se compartió esta semana');
    assert.ok(pegas > -1 && pegas < banner && banner < canales, 'el banner va entre Pegas y los canales');
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

test('permite etiqueta y CTA propios en el destacado y mantiene los defaults', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-destacado-texto-'));
  const fechaCard = '2099-03-06';
  const edicion = path.join(tmp, 'ediciones', fechaCard);
  const base = `# Semanario de prueba\n\n## Actividad de la comunidad\n\n- **2 mensajes** publicados en los canales de contenido.\n- **Viernes 6** fue el día más activo, con **2 mensajes**.\n\n## Pegas\n\nDurante la semana se publicó **1 pega nueva**.\n\n## Links de la semana\n\n### #comunidad\n\n- Se compartió un proyecto. [Ver proyecto](https://example.com/proyecto).\n`;

  try {
    await mkdir(edicion, { recursive: true });
    await writeFile(path.join(tmp, 'template.html'), await readFile(path.join(raiz, 'template.html')));

    // Con etiqueta y CTA propios: se usan tal cual y no queda rastro del marco de "proyecto".
    await writeFile(path.join(edicion, 'resumen.md'), `${base}\n<!-- SEMANARIO_CIERRE\nproyecto_link: https://example.com/encuesta\nproyecto_etiqueta: ✨ Mini-estudio de la comunidad\nproyecto_titulo: Encuesta de prueba\nproyecto_descripcion: Tus aportes son valorados.\nproyecto_cta: Responder la encuesta →\ndespedida: Nos leemos la próxima semana.\n-->\n`);
    execFileSync('node', ['scripts/generar_newsletter.mjs', fechaCard], {
      cwd: raiz, env: { ...process.env, SEMANARIO_ROOT: tmp, SITE_URL: 'https://preview.example' }, stdio: 'pipe',
    });
    let html = await readFile(path.join(edicion, 'newsletter.html'), 'utf8');
    assert.match(html, /✨ Mini-estudio de la comunidad/);
    assert.match(html, />Responder la encuesta →<\/a>/);
    assert.match(html, /color:#2DD4BF;text-decoration:none;font-size:12px;">Responder la encuesta →<\/a>/);
    assert.match(html, /Tus aportes son valorados\./);
    assert.doesNotMatch(html, /Conocer el proyecto/);
    assert.doesNotMatch(html, /Proyecto destacado de la comunidad/);

    // Sin etiqueta ni CTA: vuelven los textos por defecto.
    await writeFile(path.join(edicion, 'resumen.md'), `${base}\n<!-- SEMANARIO_CIERRE\nproyecto_link: https://example.com/proyecto\nproyecto_titulo: Proyecto de prueba\ndespedida: Nos leemos la próxima semana.\n-->\n`);
    execFileSync('node', ['scripts/generar_newsletter.mjs', fechaCard], {
      cwd: raiz, env: { ...process.env, SEMANARIO_ROOT: tmp, SITE_URL: 'https://preview.example' }, stdio: 'pipe',
    });
    html = await readFile(path.join(edicion, 'newsletter.html'), 'utf8');
    assert.match(html, /✨ Proyecto destacado de la comunidad/);
    assert.match(html, /Conocer el proyecto →/);
    assert.match(html, /color:#2DD4BF;text-decoration:none;font-size:12px;">Conocer el proyecto →<\/a>/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('agrega utm_source a todos los links HTTP y conserva query y fragment', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-utm-'));
  const fechaUtm = '2099-04-06';
  const edicion = path.join(tmp, 'ediciones', fechaUtm);

  try {
    await mkdir(edicion, { recursive: true });
    await writeFile(path.join(tmp, 'template.html'), await readFile(path.join(raiz, 'template.html')));
    await writeFile(path.join(edicion, 'resumen.md'), `# Semanario de prueba\n\n## Actividad de la comunidad\n\n- **2 mensajes** publicados en los canales de contenido.\n- **Lunes 6** fue el día más activo, con **2 mensajes**.\n\n## Pegas\n\nDurante la semana se publicó **1 pega nueva**.\n\n## Links de la semana\n\n### #comunidad\n\n- [Link simple](https://example.com/recurso).\n- [Link con query](http://example.net/ruta?foo=bar&baz=qux#detalle).\n`);
    execFileSync('node', ['scripts/generar_newsletter.mjs', fechaUtm], {
      cwd: raiz, env: { ...process.env, SEMANARIO_ROOT: tmp }, stdio: 'pipe',
    });

    const html = await readFile(path.join(edicion, 'newsletter.html'), 'utf8');
    const urls = [...html.matchAll(/href="([^"]+)"/g)].map(([, href]) => new URL(href.replaceAll('&amp;', '&')));
    assert.ok(urls.length > 0, 'la edición debe contener links HTTP');
    assert.ok(urls.every(url => url.searchParams.get('utm_source') === 'semanario_devschile'));
    const conQuery = urls.find(url => url.hostname === 'example.net');
    assert.equal(conQuery?.searchParams.get('foo'), 'bar');
    assert.equal(conQuery?.searchParams.get('baz'), 'qux');
    assert.equal(conQuery?.hash, '#detalle');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('ubica varios screenshots bajo sus canales con screenshot_2', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-visuales-multi-'));
  const fechaMulti = '2099-05-08';
  const edicion = path.join(tmp, 'ediciones', fechaMulti);

  try {
    await mkdir(edicion, { recursive: true });
    await writeFile(path.join(tmp, 'template.html'), await readFile(path.join(raiz, 'template.html')));
    await writeFile(path.join(edicion, 'resumen.md'), `# Semanario de prueba

## Actividad de la comunidad

- **2 mensajes** publicados en los canales de contenido.
- **Viernes 8** fue el día más activo, con **2 mensajes**.

## Pegas

Durante la semana se publicó **1 pega nueva**.

## Links de la semana

### #ai

- Se compartió una herramienta. [Ver herramienta](https://example.com/ai).

### #desarrollo

- Se compartió un dataset. [Ver dataset](https://example.com/datos).

<!-- SEMANARIO_VISUALES
screenshot: assets/vistazo-ai.jpg
screenshot_link: https://example.com/ai
screenshot_alt: Captura de la herramienta
screenshot_caption: La conversación de #ai.
screenshot_2: assets/vistazo-desarrollo.jpg
screenshot_2_link: https://example.com/datos
screenshot_2_alt: Captura del dataset
screenshot_2_caption: El link de #desarrollo.
screenshot_2_canal: #desarrollo
screenshot_2_etiqueta: 👀 Un vistazo al dataset
-->

<!-- SEMANARIO_PLACEMENT
screenshot_canal: #ai
-->
`);
    execFileSync('node', ['scripts/generar_newsletter.mjs', fechaMulti], {
      cwd: raiz, env: { ...process.env, SEMANARIO_ROOT: tmp, SITE_URL: 'https://preview.example' }, stdio: 'pipe',
    });
    const html = await readFile(path.join(edicion, 'newsletter.html'), 'utf8');
    const ai = html.indexOf('>#ai</span>');
    const desarrollo = html.indexOf('>#desarrollo</span>');
    const vistazoAi = html.indexOf('vistazo-ai.jpg');
    const vistazoDesarrollo = html.indexOf('vistazo-desarrollo.jpg');
    const itemDesarrollo = html.indexOf('Ver dataset', desarrollo);

    assert.ok(ai > -1 && ai < vistazoAi, 'el primer screenshot va bajo #ai');
    assert.ok(desarrollo > -1 && desarrollo < vistazoDesarrollo, 'screenshot_2 va bajo #desarrollo');
    assert.ok(vistazoDesarrollo < itemDesarrollo, 'el screenshot va antes de los items restantes de su canal');
    assert.match(html, /👀 Un vistazo al dataset/);
    assert.equal([...html.matchAll(/👀 Un vistazo a la conversación/g)].length, 1);
    assert.doesNotMatch(html, /{{[A-Z_]+}}/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('renderiza la captura del proyecto destacado cuando se declara proyecto_imagen', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-destacado-imagen-'));
  const fechaImagen = '2099-06-12';
  const edicion = path.join(tmp, 'ediciones', fechaImagen);

  try {
    await mkdir(edicion, { recursive: true });
    await writeFile(path.join(tmp, 'template.html'), await readFile(path.join(raiz, 'template.html')));
    await writeFile(path.join(edicion, 'resumen.md'), `# Semanario de prueba

## Actividad de la comunidad

- **2 mensajes** publicados en los canales de contenido.
- **Viernes 12** fue el día más activo, con **2 mensajes**.

## Pegas

Durante la semana se publicó **1 pega nueva**.

## Links de la semana

### #comunidad

- Se compartió un proyecto. [Ver proyecto](https://example.com/proyecto).

<!-- SEMANARIO_CIERRE
proyecto_link: https://showcase.example/proyecto
proyecto_titulo: Proyecto con captura
proyecto_descripcion: Una descripción breve.
proyecto_imagen: assets/proyecto.jpg
proyecto_imagen_alt: Captura del proyecto con indicadores
despedida: Nos leemos la próxima semana.
-->
`);
    execFileSync('node', ['scripts/generar_newsletter.mjs', fechaImagen], {
      cwd: raiz, env: { ...process.env, SEMANARIO_ROOT: tmp, SITE_URL: 'https://preview.example' }, stdio: 'pipe',
    });
    const html = await readFile(path.join(edicion, 'newsletter.html'), 'utf8');
    const imagen = html.indexOf('https://preview.example/newsletter/2099-06-12/assets/proyecto.jpg');
    const titulo = html.indexOf('Proyecto con captura');

    assert.ok(imagen > -1, 'la imagen del proyecto debe usar la URL pública del asset');
    assert.ok(imagen < titulo, 'la captura debe preceder al título dentro de la tarjeta');
    assert.match(html, /alt="Captura del proyecto con indicadores"/);
    assert.doesNotMatch(html, /{{[A-Z_]+}}/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('publica la subsección Más avisos compartidos en el bloque de pegas', async () => {
  const tmp = await mkdtemp(path.join('/tmp', 'semanario-avisos-'));
  const fechaAvisos = '2099-03-07';
  const edicion = path.join(tmp, 'ediciones', fechaAvisos);

  try {
    await mkdir(edicion, { recursive: true });
    await writeFile(path.join(tmp, 'template.html'), await readFile(path.join(raiz, 'template.html')));
    await writeFile(path.join(edicion, 'resumen.md'), '# Semanario de prueba\n\n## Actividad de la comunidad\n\n- **300 mensajes** publicados en los canales de contenido.\n- **Jueves 5** fue el día más activo, con **40 mensajes**.\n\n## Pegas\n\nDurante la semana se publicaron **9 pegas nuevas**.\n\n### Destacadas con sueldo visible\n\n- [Senior en Kit](https://example.com/kit) — remoto, USD 190.000 al año.\n\n### Más avisos compartidos\n\n- `jorgeepunan` pasó dos [Tech Lead en Bci](https://example.com/bci) y [Tech Lead en Diesel](https://example.com/diesel).\n\n## Links de la semana\n\n### #comunidad\n\n- Se compartió un proyecto. [Ver proyecto](https://example.com/proyecto).\n');

    execFileSync('node', ['scripts/generar_newsletter.mjs', fechaAvisos], {
      cwd: raiz, env: { ...process.env, SEMANARIO_ROOT: tmp, SITE_URL: 'https://preview.example' }, stdio: 'pipe',
    });
    const html = await readFile(path.join(edicion, 'newsletter.html'), 'utf8');

    assert.match(html, /Más avisos compartidos/);
    assert.match(html, /href="https:\/\/example\.com\/bci\?utm_source=semanario_devschile"/);
    assert.match(html, /href="https:\/\/example\.com\/diesel\?utm_source=semanario_devschile"/);
    assert.ok(html.indexOf('example.com/kit') < html.indexOf('example.com/bci'), 'los avisos van después de las destacadas');
    assert.doesNotMatch(html, /`jorgeepunan`/);
    assert.doesNotMatch(html, /{{[A-Z_]+}}/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
