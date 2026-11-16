#!/usr/bin/env node
/**
 * PROPUESTA v2 — genera `propuesta.html` (formato «leaderboard», cercano a
 * Product Hunt) a partir de:
 *   - ediciones/YYYY-MM-DD/propuesta.json  → contenido curado, sin nombres
 *     de personas, ordenado por tema y no por canal
 *   - template-propuesta.html              → maqueta
 *
 * No toca `template.html`, `newsletter.html` ni el pipeline vigente: es una
 * rama de exploración, se corre a mano y escribe un archivo distinto.
 *
 * Uso: node scripts/generar_propuesta.mjs YYYY-MM-DD
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const fecha = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) {
  throw new Error('Uso: node scripts/generar_propuesta.mjs YYYY-MM-DD');
}

const raiz = path.resolve(process.env.SEMANARIO_ROOT ?? path.resolve(import.meta.dirname, '..'));
const siteUrl = (process.env.SITE_URL ?? 'https://semanario.devschile.cl').replace(/\/$/, '');
const dir = path.join(raiz, 'ediciones', fecha);
const datos = JSON.parse(await readFile(path.join(dir, 'propuesta.json'), 'utf8'));
let html = await readFile(path.join(raiz, 'template-propuesta.html'), 'utf8');

const CORAL = '#FF6154';
const TINTA = '#1F1D2B';
const SUAVE = '#55536B';
const BORDE = '#E7E3DC';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'SF Mono',Menlo,Consolas,'Courier New',monospace";

const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const [anio, mes, dia] = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/).slice(1).map(Number);
const cierre = new Date(Date.UTC(anio, mes - 1, dia));
const inicio = new Date(cierre);
inicio.setUTCDate(cierre.getUTCDate() - ((cierre.getUTCDay() + 6) % 7));
const conMes = d => `${d.getUTCDate()} de ${meses[d.getUTCMonth()]}`;
const rango = inicio.getUTCMonth() === cierre.getUTCMonth()
  ? `${inicio.getUTCDate()} al ${conMes(cierre)}`
  : `${conMes(inicio)} al ${conMes(cierre)}`;
const fechaLarga = `${dias[cierre.getUTCDay()]}, ${conMes(cierre)} de ${cierre.getUTCFullYear()}`;

const numero = (await readdir(path.join(raiz, 'ediciones'), { withFileTypes: true }))
  .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name) && e.name <= fecha)
  .length;

const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function urlAsset(valor) {
  if (!valor) return '';
  if (/^https?:\/\//i.test(valor)) return valor;
  const relativo = valor.replace(/^\.?\//, '');
  // Para revisar la propuesta en local: ASSETS_BASE=http://127.0.0.1:8899 y el
  // servidor apuntando a la raíz del worktree (ruta real del archivo).
  if (process.env.ASSETS_BASE) return `${process.env.ASSETS_BASE.replace(/\/$/, '')}/ediciones/${fecha}/${relativo}`;
  return `${siteUrl}/newsletter/${fecha}/${relativo}`;
}

function enlace(href, texto, estilo = '') {
  return `<a href="${escapar(href)}" style="color:inherit;text-decoration:underline;${estilo}">${texto}</a>`;
}

function chips(links) {
  return links.map(l => `<a href="${escapar(l.url)}" style="display:inline-block;margin:8px 6px 0 0;padding:3px 10px;border:1px solid #E7E3DC;border-radius:4px;font-family:${FONT};font-size:12px;font-weight:600;color:${TINTA};text-decoration:none;">${escapar(l.texto)} <span style="color:${CORAL};">↗</span></a>`).join('');
}

function pill(texto) {
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background-color:#F1EEE9;color:#6B6779;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${escapar(texto)}</span>`;
}

/* ── bloques ────────────────────────────────────────────────────────────── */

const heroBajada = (datos.hero.bajada ?? [])
  .map(p => `<p style="margin:14px 0 0 0;font-family:${FONT};font-size:16px;line-height:1.65;color:${SUAVE};">${escapar(p)}</p>`)
  .join('\n            ');

const auspicio = datos.hero.auspicio ?? null;
const auspicioHeader = auspicio
  ? `<a href="${escapar(auspicio.url)}" style="color:${CORAL};text-decoration:none;font-weight:700;">Auspicia esta edición →</a>`
  : '';
const auspicioBloque = auspicio
  ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0 0;background-color:#FFF7F5;border:1px solid #FFD9D3;border-radius:6px;">
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0;font-family:${MONO};font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:${CORAL};font-weight:700;">${escapar(auspicio.texto)}</p>
                  <p style="margin:6px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${SUAVE};">${escapar(auspicio.detalle)} · <a href="${escapar(auspicio.url)}" style="color:${CORAL};text-decoration:none;font-weight:600;">empresas.devschile.cl →</a></p>
                </td>
              </tr>
            </table>`
  : '';

const destacados = (datos.destacados ?? []).map((d, i) => `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:14px 0 20px 0;border-bottom:1px solid ${BORDE};">
              <tr>
                <td valign="top" style="width:42px;padding-top:2px;">
                  <span style="font-family:${FONT};font-size:26px;font-weight:800;letter-spacing:-0.04em;color:${CORAL};">${i + 1}</span>
                </td>
                <td valign="top">
                  <p style="margin:0 0 4px 0;">${pill(d.tema)}</p>
                  <h3 style="margin:0;font-family:${FONT};font-size:19px;line-height:1.3;letter-spacing:-0.02em;font-weight:800;color:${TINTA};"><a href="${escapar(d.url)}" style="color:${TINTA};text-decoration:none;">${escapar(d.titulo)}</a> <span style="color:${CORAL};font-weight:700;">↗</span></h3>
                  <p style="margin:8px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${SUAVE};">${escapar(d.descripcion)}</p>
                  ${d.imagen ? `<a href="${escapar(d.url)}" style="text-decoration:none;display:block;margin:12px 0 0 0;"><img src="${escapar(urlAsset(d.imagen))}" alt="${escapar(d.titulo)}" width="488" style="display:block;width:100%;max-width:488px;height:auto;border:1px solid ${BORDE};border-radius:6px;"></a>` : ''}
                </td>
              </tr>
            </table>`).join('\n');

const comunidad = datos.comunidad ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 6px 0;background-color:#F7FBFA;border:1px solid #CFEDE7;border-radius:8px;">
              <tr>
                <td style="padding:18px 18px 16px 18px;">
                  <p style="margin:0;font-family:${MONO};font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#0F9E8E;font-weight:700;">${escapar(datos.comunidad.etiqueta)}</p>
                  ${datos.comunidad.imagen ? `<a href="${escapar(datos.comunidad.url)}" style="text-decoration:none;display:block;margin:10px 0 12px 0;"><img src="${escapar(urlAsset(datos.comunidad.imagen))}" alt="${escapar(datos.comunidad.titulo)}" width="452" style="display:block;width:100%;max-width:452px;height:auto;border:1px solid #CFEDE7;border-radius:6px;"></a>` : ''}
                  <h3 style="margin:0;font-family:${FONT};font-size:19px;line-height:1.3;letter-spacing:-0.02em;font-weight:800;color:${TINTA};">${escapar(datos.comunidad.titulo)}</h3>
                  <p style="margin:8px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${SUAVE};">${escapar(datos.comunidad.descripcion)}</p>
                  <p style="margin:12px 0 0 0;font-family:${FONT};font-size:14px;font-weight:700;"><a href="${escapar(datos.comunidad.url)}" style="color:#0F9E8E;text-decoration:none;">${escapar(datos.comunidad.cta)}</a></p>
                </td>
              </tr>
            </table>` : '';

const secciones = (datos.secciones ?? []).map(s => `
        <tr>
          <td style="padding:24px 28px 0 28px;">
            <h2 style="margin:0 0 2px 0;font-family:${FONT};font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${TINTA};"><span style="border-bottom:3px solid ${CORAL};padding-bottom:4px;">${escapar(s.tema)}</span></h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0 0;">
              ${s.items.map(item => {
                const principal = item.links?.[0]?.url;
                const titulo = principal
                  ? `<a href="${escapar(principal)}" style="color:${TINTA};text-decoration:none;">${escapar(item.titulo)} <span style="color:${CORAL};font-weight:700;">↗</span></a>`
                  : escapar(item.titulo);
                const extra = (item.links ?? []).slice(1);
                return `<tr>
                <td style="padding:0 0 18px 0;">
                  <p style="margin:0;font-family:${FONT};font-size:16px;line-height:1.4;font-weight:700;letter-spacing:-0.01em;color:${TINTA};">${titulo}</p>
                  <p style="margin:5px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${SUAVE};">${escapar(item.descripcion)}</p>
                  ${extra.length ? `<p style="margin:0;">${chips(extra)}</p>` : ''}
                </td>
              </tr>`;
              }).join('\n              ')}
            </table>
          </td>
        </tr>`).join('\n');

const compactos = datos.compactos ? `
            <h2 style="margin:10px 0 12px 0;font-family:${FONT};font-size:16px;font-weight:800;letter-spacing:-0.01em;color:${TINTA};">${escapar(datos.compactos.titulo)} <span style="color:${SUAVE};font-weight:500;">— lo que quedó dando vueltas</span></h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDE};">
              ${datos.compactos.items.map((item, i, arr) => {
                const temaVisible = item.tema && item.tema !== arr[i - 1]?.tema;
                return `<tr>
                <td style="padding:9px 0;border-bottom:1px solid ${BORDE};">
                  <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.5;color:${SUAVE};"><a href="${escapar(item.url)}" style="color:${TINTA};text-decoration:none;font-weight:600;">${escapar(item.titulo)} <span style="color:${CORAL};">↗</span></a>${temaVisible ? ` <span style="color:#9B97A8;font-size:12px;">· ${escapar(item.tema)}</span>` : ''}</p>
                </td>
              </tr>`;
              }).join('\n              ')}
            </table>` : '';

const pegas = datos.pegas ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 0 0;background-color:#FAF8F5;border:1px solid ${BORDE};border-radius:8px;">
              <tr>
                <td style="padding:18px;">
                  <h3 style="margin:0;font-family:${FONT};font-size:17px;font-weight:800;letter-spacing:-0.01em;color:${TINTA};"><span style="border-bottom:3px solid ${CORAL};padding-bottom:3px;">${escapar(datos.pegas.titulo)}</span></h3>
                  <p style="margin:12px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${SUAVE};">${escapar(datos.pegas.intro)}</p>
                  ${(datos.pegas.destacadas ?? []).map(p => `<p style="margin:10px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${SUAVE};"><a href="${escapar(p.url)}" style="color:${TINTA};font-weight:700;text-decoration:underline;">${escapar(p.titulo)}</a> · ${escapar(p.empresa)} · ${escapar(p.detalle)} <span style="display:inline-block;margin-left:4px;padding:1px 8px;border-radius:999px;background-color:#E7F5EC;color:#146B3A;font-size:11px;font-weight:700;">${escapar(p.sueldo)}</span></p>`).join('\n                  ')}
                  <p style="margin:14px 0 0 0;font-family:${FONT};font-size:14px;font-weight:700;"><a href="${escapar(datos.pegas.url)}" style="color:${CORAL};text-decoration:none;">${escapar(datos.pegas.cta)}</a></p>
                </td>
              </tr>
            </table>` : '';

const proyectoData = datos.cierre?.proyecto;
const proyecto = proyectoData ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDE};border-radius:8px;">
              <tr>
                <td style="padding:16px 18px;">
                  <p style="margin:0;font-family:${MONO};font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#7A7688;font-weight:700;">${escapar(proyectoData.etiqueta)}</p>
                  <h3 style="margin:7px 0 0 0;font-family:${FONT};font-size:18px;font-weight:800;letter-spacing:-0.02em;color:${TINTA};">${escapar(proyectoData.titulo)}</h3>
                  <p style="margin:6px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${SUAVE};">${escapar(proyectoData.descripcion)}</p>
                  <p style="margin:10px 0 0 0;font-family:${FONT};font-size:14px;font-weight:700;"><a href="${escapar(proyectoData.url)}" style="color:${CORAL};text-decoration:none;">${escapar(proyectoData.cta)}</a></p>
                </td>
              </tr>
            </table>` : '';

const preheader = `${datos.destacados?.[0]?.titulo ?? 'El Semanario'} y ${datos.compactos?.items?.length ?? 0} links más de la semana en devsChile`;

const totalLinks = (datos.destacados?.length ?? 0)
  + (datos.comunidad ? 1 : 0)
  + (datos.secciones ?? []).reduce((n, s) => n + s.items.reduce((m, it) => m + (it.links?.length ?? 0), 0), 0)
  + (datos.compactos?.items?.length ?? 0);
const statsHero = [
  `${totalLinks} links`,
  `${(datos.secciones ?? []).length} temas`,
  datos.pegas?.total ? `${datos.pegas.total} pegas nuevas` : '',
].filter(Boolean).join(' · ');

/* ── reemplazos ─────────────────────────────────────────────────────────── */

const reemplazos = {
  '{{LOGO}}': urlAsset('assets-propuesta/logo.png'),
  '{{PREHEADER}}': escapar(preheader),
  '{{NUMERO}}': String(numero),
  '{{FECHA}}': fecha,
  '{{SITE_URL}}': siteUrl,
  '{{FECHA_LARGA}}': fechaLarga,
  '{{RANGO}}': rango,
  '{{AUSPICIO_HEADER}}': auspicioHeader,
  '{{AUSPICIO_BLOQUE}}': auspicioBloque,
  '{{HERO_TITULO}}': escapar(datos.hero.titulo),
  '{{HERO_BAJADA}}': heroBajada,
  '{{HERO_STATS}}': escapar(statsHero),
  '{{DESTACADOS}}': destacados,
  '{{COMUNIDAD}}': comunidad,
  '{{SECCIONES}}': secciones,
  '{{COMPACTOS}}': compactos,
  '{{PEGAS}}': pegas,
  '{{CIERRE}}': escapar(datos.cierre?.texto ?? ''),
  '{{PROYECTO}}': proyecto,
};

for (const [clave, valor] of Object.entries(reemplazos)) html = html.replaceAll(clave, valor);

const pendientes = [...html.matchAll(/{{[A-Z_]+}}/g)].map(m => m[0]);
if (pendientes.length) throw new Error(`Quedaron marcadores sin reemplazar: ${[...new Set(pendientes)].join(', ')}`);

await writeFile(path.join(dir, 'propuesta.html'), html);
console.log(`✔ Generado ediciones/${fecha}/propuesta.html (Semanario #${numero})`);
