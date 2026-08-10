#!/usr/bin/env node
/** Genera newsletter.html desde ediciones/YYYY-MM-DD/resumen.md. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const fecha = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) {
  throw new Error('Uso: node scripts/generar_newsletter.mjs YYYY-MM-DD');
}
const raiz = path.resolve(import.meta.dirname, '..');
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
  out = out.replace(/(US\$[\d.,]+(?:[–-][\d.,]+)?(?:k)?(?:\/año|\/mes)?(?: \+ equity)?)/gi, '<span style="display:inline-block;padding:1px 8px;border-radius:999px;background-color:#143322;color:#4ADE80;font-size:12px;font-weight:600;">$1</span>');
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
function bloquesCanal(texto) {
  return [...texto.matchAll(/^### (#[^\n]+)\n([\s\S]*?)(?=^### |(?![\s\S]))/gm)].map(([, canal, cuerpo]) => {
    const items = lista(cuerpo).map(x => `<li>${markup(x)}</li>`).join('\n                ');
    return `              <p style="margin:18px 0 8px 0;"><span style="display:inline-block;padding:3px 12px;border-radius:999px;background-color:#143A33;color:#2DD4BF;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;">${escapar(canal)}</span></p>\n              <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#C9C6D8;">\n                ${items}\n              </ul>`;
  }).join('\n');
}

const actividad = lista(section('Actividad de la comunidad')).map(markup).join('<br>\n                • ');
const pegas = section('Pegas');
const introPegas = pegas.split(/^### /m)[0].trim();
const destacadas = lista(subsection(pegas, 'Destacadas con sueldo visible'))
  .map(x => `<li>${markup(x)}</li>`).join('\n                ');
const links = section('Links de la semana');
const anuncios = section('#anuncios').replace(/^\*\*Nota editorial:[\s\S]*$/m, '').trim();

html = html
  .replaceAll('{{RANGO}}', rango)
  .replaceAll('{{PREHEADER}}', '567 mensajes, 87 pegas nuevas y el jueves 6 como día más activo')
  .replaceAll('{{ACTIVIDAD}}', `• ${actividad}`)
  .replaceAll('{{PEGAS}}', markup(introPegas))
  .replaceAll('{{PEGAS_DESTACADAS}}', destacadas)
  .replaceAll('{{CANALES}}', bloquesCanal(links));

if (anuncios) {
  html = html
    .replaceAll('{{ANUNCIOS}}', markup(anuncios))
    .replace('          <!--\n          <tr>', '          <tr>')
    .replace('          </tr>\n          -->\n\n          <!-- PEGAS', '          </tr>\n\n          <!-- PEGAS');
} else {
  html = html.replace('{{ANUNCIOS}}', '');
}

const marcadoresPendientes = [...html.matchAll(/{{[A-Z_]+}}/g)].map(m => m[0]);
if (marcadoresPendientes.length) throw new Error(`Quedaron marcadores sin reemplazar: ${[...new Set(marcadoresPendientes)].join(', ')}`);
await writeFile(path.join(dir, 'newsletter.html'), html);
console.log(`✔ Generado ediciones/${fecha}/newsletter.html`);
