#!/usr/bin/env node
/** Genera newsletter.html desde ediciones/YYYY-MM-DD/resumen.md. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const fecha = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) {
  throw new Error('Uso: node scripts/generar_newsletter.mjs YYYY-MM-DD');
}
const raiz = path.resolve(process.env.SEMANARIO_ROOT ?? path.resolve(import.meta.dirname, '..'));
const siteUrl = (process.env.SITE_URL ?? 'https://semanario.devschile.cl').replace(/\/$/, '');
const dir = path.join(raiz, 'ediciones', fecha);
const md = await readFile(path.join(dir, 'resumen.md'), 'utf8');
let html = await readFile(path.join(raiz, 'template.html'), 'utf8');

const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const [anio, mes, dia] = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/).slice(1).map(Number);
const cierre = new Date(Date.UTC(anio, mes - 1, dia));
const inicio = new Date(cierre);
inicio.setUTCDate(cierre.getUTCDate() - ((cierre.getUTCDay() + 6) % 7));
const fechaCorta = d => `${d.getUTCDate()} ${meses[d.getUTCMonth()]}`;
const rango = inicio.getUTCMonth() === cierre.getUTCMonth() && inicio.getUTCFullYear() === cierre.getUTCFullYear()
  ? `${inicio.getUTCDate()} – ${fechaCorta(cierre)} ${cierre.getUTCFullYear()}`
  : `${fechaCorta(inicio)} – ${fechaCorta(cierre)} ${cierre.getUTCFullYear()}`;

function escapar(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function markup(s) {
  let out = escapar(s.trim());
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" style="color:#2DD4BF;text-decoration:none;">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#ffffff;">$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/((?:US\$)?\d[\d.,]*k?(?:[–-](?:US\$)?\d[\d.,]*k?)?\/(?:año|mes)(?: \+ equity)?)/gi, '<span style="display:inline-block;padding:1px 8px;border-radius:999px;background-color:#143322;color:#4ADE80;font-size:12px;font-weight:600;">$1</span>');
  return out;
}
function section(nombre) {
  const re = new RegExp(`^## ${nombre}\\n([\\s\\S]*?)(?=^## |\\n---|(?![\\s\\S]))`, 'm');
  return md.match(re)?.[1].trim() ?? '';
}
function subsection(texto, nombre) {
  const re = new RegExp(`^### ${nombre}\\n([\\s\\S]*?)(?=^### |(?![\\s\\S]))`, 'm');
  return texto.match(re)?.[1].trim() ?? '';
}
function lista(texto) {
  return [...texto.matchAll(/^- (.+)$/gm)].map(m => m[1]);
}
function bloqueScreenshotTabla(visuales) {
  const src = urlVisual(visuales.screenshot);
  if (!src) return '';
  const link = urlVisual(visuales.screenshot_link) || (visuales.screenshot_link?.startsWith('http') ? visuales.screenshot_link : '');
  const href = link || src;
  const alt = escapar(visuales.screenshot_alt || 'Captura de una conversación o proyecto compartido por la comunidad');
  const caption = markup(visuales.screenshot_caption || 'Un vistazo a la conversación de la comunidad');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#141025;border:1px solid #2A2444;border-radius:6px;">\n                <tr>\n                  <td style="padding:14px 16px 16px 16px;">\n                    <p style="margin:0 0 10px 0;color:#9794A8;font-family:'Inconsolata','Courier New',monospace;font-size:11px;letter-spacing:0.04em;text-transform:uppercase;">👀 Un vistazo a la conversación</p>\n                    <a href="${escapar(href)}" style="text-decoration:none;"><img src="${escapar(src)}" alt="${alt}" width="504" style="display:block;width:100%;max-width:504px;max-height:230px;object-fit:cover;border:1px solid #2A2444;border-radius:4px;"></a>\n                    <p style="margin:10px 0 0 0;color:#8B87A0;font-size:12px;line-height:1.5;">${caption}${link ? ` · <a href="${escapar(link)}" style="color:#2DD4BF;text-decoration:none;">Ver enlace</a>` : ''}</p>\n                  </td>\n                </tr>\n              </table>`;
}
function bloquesCanal(texto, { visuales = {}, notables = '', ubicacion = {} } = {}) {
  return [...texto.matchAll(/^### (#[^\n]+)\n([\s\S]*?)(?=^### |(?![\s\S]))/gm)].map(([, canal, cuerpo]) => {
    const canalNormalizado = canal.trim().toLowerCase();
    const screenshot = ubicacion.screenshot_canal?.toLowerCase() === canalNormalizado
      ? bloqueScreenshotTabla(visuales)
      : '';
    const notable = ubicacion.notables_canal?.toLowerCase() === canalNormalizado
      ? bloquesNotables(notables, true)
      : '';
    const destacados = [screenshot, notable].filter(Boolean).join('\n              ');
    const items = lista(cuerpo).map(x => `<li>${markup(x)}</li>`).join('\n                ');
    return `              <p style="margin:18px 0 8px 0;"><span style="display:inline-block;padding:3px 12px;border-radius:999px;background-color:#143A33;color:#2DD4BF;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;">${escapar(canal)}</span></p>${destacados ? `\n              ${destacados}` : ''}\n              <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#C9C6D8;">\n                ${items}\n              </ul>`;
  }).join('\n');
}
function bloquesNotables(texto, inline = false) {
  return [...texto.matchAll(/^### ([^\n]+)\n([\s\S]*?)(?=^### |\n---|(?![\s\S]))/gm)].map(([, titulo, cuerpo]) => {
    const citas = [...cuerpo.matchAll(/^>\s?(.*)$/gm)].map(([, cita]) => cita.trim()).filter(Boolean);
    const sinCitas = cuerpo.replace(/^>\s?.*(?:\n|$)/gm, '').trim();
    const citaHtml = citas.length
      ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #2DD4BF;background-color:#100A1C;color:#ffffff;font-size:15px;line-height:1.6;font-style:italic;">${citas.map(markup).join('<br>')}</blockquote>`
      : '';
    const cuerpoHtml = sinCitas
      ? sinCitas.split(/\n\s*\n/).map(parrafo => `<p style="margin:10px 0 0 0;color:#C9C6D8;font-size:13px;line-height:1.6;">${markup(parrafo).replace(/\n/g, '<br>')}</p>`).join('\n')
      : '';
    const tabla = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1B1730;border:1px solid #2A6B61;border-radius:6px;">\n                <tr>\n                  <td style="padding:14px 18px;border-left:3px solid #2DD4BF;">\n                    <p style="margin:0;color:#2DD4BF;font-family:'Inconsolata','Courier New',monospace;font-size:11px;letter-spacing:0.04em;text-transform:uppercase;">★ Más notable</p>\n                    <h3 style="margin:8px 0 0 0;font-size:17px;color:#ffffff;font-family:'Inconsolata','Courier New',monospace;">${markup(titulo)}</h3>\n                    ${citaHtml}\n                    ${cuerpoHtml}\n                  </td>\n                </tr>\n              </table>`;
    return inline
      ? tabla
      : `          <tr>\n            <td style="padding:14px 32px 8px 32px;">\n              ${tabla}\n            </td>\n          </tr>`;
  }).join('\n');
}
function metadataBloque(nombre) {
  const bloque = md.match(new RegExp(`<!--\\s*${nombre}\\s*([\\s\\S]*?)-->`, 'i'))?.[1] ?? '';
  return Object.fromEntries([...bloque.matchAll(/^\s*([a-z_]+)\s*:\s*(.*?)\s*$/gim)]
    .map(([, clave, valor]) => [clave.toLowerCase(), valor.trim()]));
}
function metadataVisuales() {
  return metadataBloque('SEMANARIO_VISUALES');
}
function metadataUbicacion() {
  return metadataBloque('SEMANARIO_PLACEMENT');
}
function metadataCierre() {
  return metadataBloque('SEMANARIO_CIERRE');
}
function urlVisual(valor) {
  if (!valor) return '';
  if (/^https?:\/\//i.test(valor)) return valor;
  const relativo = valor.replace(/^\.\//, '').replace(/^\//, '');
  if (!/^assets\//i.test(relativo)) return '';
  return `${siteUrl}/newsletter/${fecha}/${relativo}`;
}
function enlaceExterno(valor) {
  return /^https?:\/\//i.test(valor ?? '') ? valor : '';
}
function visualAnuncio(visuales, hayAnuncios) {
  const src = hayAnuncios ? urlVisual(visuales.anuncio) : '';
  if (!src) return '';
  const alt = escapar(visuales.anuncio_alt || 'Ilustración de un anuncio de la comunidad devsChile');
  return `          <tr>\n            <td style="padding:16px 32px 2px 32px;">\n              <img src="${escapar(src)}" alt="${alt}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:6px;">\n            </td>\n          </tr>`;
}
function visualScreenshot(visuales) {
  const tabla = bloqueScreenshotTabla(visuales);
  if (!tabla) return '';
  return `          <tr>\n            <td style="padding:16px 32px 6px 32px;">\n              ${tabla}\n            </td>\n          </tr>`;
}
function tarjetaProyecto(cierre) {
  const href = enlaceExterno(cierre.proyecto_link);
  if (!href) return '';
  const titulo = markup(cierre.proyecto_titulo || 'Proyecto destacado de la comunidad');
  const descripcion = cierre.proyecto_descripcion
    ? `<p style="margin:8px 0 0 0;color:#C9C6D8;font-size:13px;line-height:1.6;">${markup(cierre.proyecto_descripcion)}</p>`
    : '';
  return `          <tr>\n            <td style="padding:18px 32px 8px 32px;">\n              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#141025;border:1px solid #2A6B61;border-radius:6px;">\n                <tr>\n                  <td style="padding:16px 18px;border-left:3px solid #2DD4BF;">\n                    <p style="margin:0;color:#8B87A0;font-family:'Inconsolata','Courier New',monospace;font-size:11px;letter-spacing:0.04em;text-transform:uppercase;">✨ Proyecto destacado de la comunidad</p>\n                    <h2 style="margin:8px 0 0 0;font-size:17px;color:#ffffff;font-family:'Inconsolata','Courier New',monospace;"><a href="${escapar(href)}" style="color:#2DD4BF;text-decoration:none;">${titulo}</a></h2>\n                    ${descripcion}\n                    <p style="margin:10px 0 0 0;"><a href="${escapar(href)}" style="color:#2DD4BF;text-decoration:none;font-size:12px;">Conocer el proyecto →</a></p>\n                  </td>\n                </tr>\n              </table>\n            </td>\n          </tr>`;
}
function bloqueDespedida(cierre) {
  if (!cierre.despedida) return '';
  return `          <tr>\n            <td align="center" style="padding:14px 40px 4px 40px;">\n              <p style="margin:0;color:#C9C6D8;font-size:14px;line-height:1.7;font-style:italic;">${markup(cierre.despedida)}</p>\n            </td>\n          </tr>`;
}
function bloqueFirma(cierre) {
  const src = urlVisual(cierre.firma);
  if (!src) return '';
  const alt = escapar(cierre.firma_alt || 'Firmas caligráficas de la comunidad devsChile');
  return `          <tr>\n            <td align="center" style="padding:4px 32px 20px 32px;">\n              <img src="${escapar(src)}" alt="${alt}" width="420" style="display:block;width:100%;max-width:420px;height:auto;border:0;">\n            </td>\n          </tr>`;
}


const actividadItems = lista(section('Actividad de la comunidad'));
const actividad = actividadItems.map(markup).join('<br>\n                • ');
const pegas = section('Pegas');
const introPegas = pegas.split(/^### /m)[0].trim();
const mensajesPreheader = actividadItems[0]?.match(/\d[\d.,]* mensajes/)?.[0] ?? 'la actividad de la comunidad';
const pegasPreheader = introPegas.match(/\d[\d.,]* pegas nuevas/)?.[0] ?? 'nuevas pegas';
const diaPreheader = actividadItems[1]?.match(/\*\*([^*]+)\*\* fue el día/)?.[1]?.toLowerCase();
const preheader = `${mensajesPreheader}, ${pegasPreheader}${diaPreheader ? ` y ${diaPreheader} como día más activo` : ''}`;
const destacadas = lista(subsection(pegas, 'Destacadas con sueldo visible'))
  .map(x => `<li>${markup(x)}</li>`).join('\n                ');
const links = section('Links de la semana');
const notables = section('Más notables');
const anuncios = section('#anuncios').replace(/^\*\*Nota editorial:[\s\S]*$/m, '').trim();
const anunciosHtml = markup(anuncios).replace(/\n[ \t]*\n/g, '<br><br>');
const visuales = metadataVisuales();
const ubicacion = metadataUbicacion();
const cierreEditorial = metadataCierre();
const screenshotEnCanal = Boolean(ubicacion.screenshot_canal && urlVisual(visuales.screenshot));
const notablesEnCanal = Boolean(ubicacion.notables_canal && notables.trim());

html = html
  .replaceAll('{{RANGO}}', rango)
  .replaceAll('{{PREHEADER}}', preheader)
  .replaceAll('{{ACTIVIDAD}}', `• ${actividad}`)
  .replaceAll('{{PEGAS}}', markup(introPegas))
  .replaceAll('{{PEGAS_DESTACADAS}}', destacadas)
  .replaceAll('{{NOTABLES}}', notablesEnCanal ? '' : bloquesNotables(notables))
  .replaceAll('{{CANALES}}', bloquesCanal(links, { visuales, notables, ubicacion }))
  .replaceAll('{{VISUAL_ANUNCIO}}', visualAnuncio(visuales, Boolean(anuncios)))
  .replaceAll('{{VISUAL_SCREENSHOT}}', screenshotEnCanal ? '' : visualScreenshot(visuales))
  .replaceAll('{{PROYECTO_DESTACADO}}', tarjetaProyecto(cierreEditorial))
  .replaceAll('{{DESPEDIDA}}', bloqueDespedida(cierreEditorial))
  .replaceAll('{{FIRMA_EDITORIAL}}', bloqueFirma(cierreEditorial));

if (anuncios) {
  html = html
    .replaceAll('{{ANUNCIOS}}', anunciosHtml)
    .replace('          <!--\n          <tr>', '          <tr>')
    .replace('          </tr>\n          -->\n\n          <!-- PEGAS', '          </tr>\n\n          <!-- PEGAS');
} else {
  html = html.replaceAll('{{ANUNCIOS}}', '');
}

html = html.replace(/^[ \t]+$/gm, '');

const marcadoresPendientes = [...html.matchAll(/{{[A-Z_]+}}/g)].map(m => m[0]);
if (marcadoresPendientes.length) throw new Error(`Quedaron marcadores sin reemplazar: ${[...new Set(marcadoresPendientes)].join(', ')}`);
await writeFile(path.join(dir, 'newsletter.html'), html);
console.log(`✔ Generado ediciones/${fecha}/newsletter.html`);
