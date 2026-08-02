/**
 * Arma el directorio de publicación (dist/) que Netlify sirve.
 *
 *   dist/
 *   ├── index.html                    landing, con la lista de ediciones inyectada
 *   ├── css/, js/, assets/            estáticos de la landing
 *   └── newsletter/
 *       ├── index.html                archivo con todas las ediciones
 *       └── YYYY-MM-DD/index.html     cada edición, desde ediciones/
 *
 * La lista de ediciones NO se escribe a mano: se genera leyendo las carpetas
 * de ediciones/. El bot pushea su edición del lunes y la landing se actualiza
 * sola en el siguiente deploy.
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const dist = path.join(raiz, 'dist');
const dirEdiciones = path.join(raiz, 'ediciones');

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Escapa texto que se interpola dentro del HTML generado. */
const escapar = (texto) =>
  texto.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** "2026-08-02" → "2 ago 2026" (sin new Date, para no pelear con zonas horarias). */
function fechaLegible(iso) {
  const [anio, mes, dia] = iso.split('-');
  return `${Number(dia)} ${MESES[Number(mes) - 1]} ${anio}`;
}

/**
 * Saca los datos de la tarjeta desde el HTML del correo, que es la fuente de
 * verdad. Se lee con regex a propósito: es un archivo generado por el bot con
 * una forma estable, y no vale la pena arrastrar un parser de HTML por esto.
 */
function extraerMetadata(html) {
  const titulo = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim() ?? '';

  // El preheader es el primer div oculto del correo.
  const preheader = html
    .match(/<div style="display:none[^"]*">([\s\S]*?)<\/div>/i)?.[1]
    .replace(/\s+/g, ' ')
    .trim() ?? '';

  // "Semanario devsChile — edición del 26 jul al 1 ago 2026" → "26 jul al 1 ago 2026"
  const rango = titulo.match(/edición del\s+(.+)$/i)?.[1].trim() ?? '';

  // El preheader viene como "📰 Semanario devsChile — <lo interesante>".
  const resumen = preheader.replace(/^.*?—\s*/, '').trim() || preheader;

  return { titulo, rango, resumen };
}

async function leerEdiciones() {
  if (!existsSync(dirEdiciones)) return [];

  const entradas = await readdir(dirEdiciones, { withFileTypes: true });
  const ediciones = [];

  for (const entrada of entradas) {
    if (!entrada.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(entrada.name)) continue;

    const archivo = path.join(dirEdiciones, entrada.name, 'newsletter.html');
    if (!existsSync(archivo)) {
      console.warn(`⚠ ${entrada.name}: sin newsletter.html, se omite.`);
      continue;
    }

    const html = await readFile(archivo, 'utf8');
    ediciones.push({ fecha: entrada.name, html, ...extraerMetadata(html) });
  }

  // Más reciente primero. El formato ISO ordena bien como string.
  ediciones.sort((a, b) => b.fecha.localeCompare(a.fecha));

  // El número de edición se asigna por antigüedad: la más vieja es la #1.
  const total = ediciones.length;
  ediciones.forEach((ed, i) => { ed.numero = total - i; });

  return ediciones;
}

/** Tarjeta de una edición para el listado. */
const tarjeta = (ed) => `        <li>
          <a class="card edition" href="/newsletter/${ed.fecha}/">
            <div class="edition-meta">
              <span class="edition-num">#${String(ed.numero).padStart(2, '0')}</span>
              <time datetime="${ed.fecha}">${fechaLegible(ed.fecha)}</time>
            </div>
            <h3>Edición del ${escapar(ed.rango)}</h3>
            <p>${escapar(ed.resumen)}</p>
          </a>
        </li>`;

/** Reemplaza lo que haya entre <!-- build:ediciones --> y <!-- /build:ediciones -->. */
function inyectar(html, contenido) {
  const marcador = /<!--\s*build:ediciones\s*-->[\s\S]*?<!--\s*\/build:ediciones\s*-->/;
  if (!marcador.test(html)) {
    throw new Error('No se encontró el marcador <!-- build:ediciones --> en index.html');
  }
  return html.replace(
    marcador,
    `<!-- build:ediciones -->\n${contenido}\n        <!-- /build:ediciones -->`,
  );
}

/** Página índice con el archivo completo, en /newsletter/. */
function paginaArchivo(ediciones) {
  return `<!DOCTYPE html>
<html lang="es-CL">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ediciones — 🗞️ Semanario devsChile</title>
  <meta name="description" content="Archivo completo de las ediciones del Semanario devsChile.">
  <link rel="icon" href="/assets/devschile-logo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&family=Inconsolata:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/">
      <img src="/assets/devschile-logo.png" alt="devsChile" width="36" height="36">
      <span class="brand-name">&lt;devschile/&gt;</span>
    </a>
    <nav class="site-nav">
      <a class="btn-primary btn-sm" href="/#suscribirse">Suscribirme</a>
    </nav>
  </header>

  <main>
    <section class="section">
      <div class="section-head">
        <h2>Todas las ediciones</h2>
        <p class="section-sub">${ediciones.length} ${ediciones.length === 1 ? 'edición publicada' : 'ediciones publicadas'}. El archivo completo es público.</p>
      </div>
      <ol class="editions">
${ediciones.map(tarjeta).join('\n')}
      </ol>
    </section>
  </main>

  <footer class="site-footer">
    <p><a href="/">← Volver a la portada</a></p>
  </footer>
</body>
</html>
`;
}

// ── Build ──────────────────────────────────────────────────────────────────

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const ediciones = await leerEdiciones();

// Estáticos de la landing.
for (const carpeta of ['css', 'js', 'assets']) {
  const origen = path.join(raiz, carpeta);
  if (existsSync(origen)) await cp(origen, path.join(dist, carpeta), { recursive: true });
}

// Portada, con las últimas 4 ediciones inyectadas.
const index = await readFile(path.join(raiz, 'index.html'), 'utf8');
const destacadas = ediciones.slice(0, 4);
await writeFile(
  path.join(dist, 'index.html'),
  inyectar(index, destacadas.map(tarjeta).join('\n')),
);

// Cada edición en /newsletter/YYYY-MM-DD/ + el archivo en /newsletter/.
await mkdir(path.join(dist, 'newsletter'), { recursive: true });
await writeFile(path.join(dist, 'newsletter', 'index.html'), paginaArchivo(ediciones));

for (const ed of ediciones) {
  const carpeta = path.join(dist, 'newsletter', ed.fecha);
  await mkdir(carpeta, { recursive: true });
  await writeFile(path.join(carpeta, 'index.html'), ed.html);
}

console.log(`✔ Build listo — ${ediciones.length} edición(es) en /newsletter/`);
for (const ed of ediciones) console.log(`  · #${ed.numero} ${ed.fecha} — ${ed.rango}`);
