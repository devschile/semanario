/**
 * Render del Semanario v2 («leaderboard») — compartido por la página web y el
 * correo del martes.
 *
 *   renderPropuesta({ fecha, modo: 'web' })    → propuesta.html
 *   renderPropuesta({ fecha, modo: 'correo' }) → newsletter.html
 *
 * El modo `correo` agrega lo que solo necesita el envío: `<title>` con el
 * rango («edición del …», que enviar.mjs usa como asunto), enlaces con
 * utm_source y los marcadores <!--VER_HTML--> / <!--BAJA_LINK--> que
 * scripts/enviar.mjs reemplaza por el link de la edición publicada y por el
 * token de baja de cada destinatario.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const ACENTO = '#0A6B60';
export const LINEA = '#14B8A6';
export const TINTA = '#1F1D2B';
export const SUAVE = '#55536B';
export const BORDE = '#DEE8E6';
export const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
export const MONO = "'SF Mono',Menlo,Consolas,'Courier New',monospace";

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const UTM_SOURCE = 'semanario_devschile';

export const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Rango y fecha larga de la semana que cierra en `fecha`. */
export function fechas(fecha) {
  const [anio, mes, dia] = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/).slice(1).map(Number);
  const cierre = new Date(Date.UTC(anio, mes - 1, dia));
  const inicio = new Date(cierre);
  inicio.setUTCDate(cierre.getUTCDate() - ((cierre.getUTCDay() + 6) % 7));
  const conMes = d => `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
  const rango = inicio.getUTCMonth() === cierre.getUTCMonth()
    ? `${inicio.getUTCDate()} al ${conMes(cierre)}`
    : `${conMes(inicio)} al ${conMes(cierre)}`;
  return {
    inicio,
    cierre,
    rango,
    anio: cierre.getUTCFullYear(),
    fechaLarga: `${DIAS[cierre.getUTCDay()]}, ${conMes(cierre)} de ${cierre.getUTCFullYear()}`,
  };
}

/** Número de edición: la carpeta más antigua es la #1. */
export async function numeroEdicion(raiz, fecha) {
  return (await readdir(path.join(raiz, 'ediciones'), { withFileTypes: true }))
    .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name) && e.name <= fecha)
    .length;
}

function urlAsset(valor, { siteUrl, fecha, assetsBase }) {
  if (!valor) return '';
  if (/^https?:\/\//i.test(valor)) return valor;
  const relativo = valor.replace(/^\.?\//, '');
  // Para revisar en local: ASSETS_BASE=http://127.0.0.1:8899 y el servidor
  // apuntando a la raíz del repo (ruta real del archivo).
  if (assetsBase) return `${assetsBase.replace(/\/$/, '')}/ediciones/${fecha}/${relativo}`;
  return `${siteUrl}/newsletter/${fecha}/${relativo}`;
}

function formato(s) {
  return escapar(s)
    .replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${TINTA};">$1</strong>`)
    .replace(/`([^`]+)`/g, `<code style="font-family:${MONO};font-size:13px;color:${TINTA};background-color:#F1F4F3;padding:1px 5px;border-radius:4px;">$1</code>`);
}

const por = usuario => usuario
  ? `<span style="display:block;margin-top:6px;font-family:${MONO};font-size:11px;color:#8A8698;">compartido por ${escapar(usuario)}</span>`
  : '';

function boton(texto, url, tono = 'teal') {
  const paletas = {
    teal: { fondo: '#E9F9F6', texto: '#0A6B60' },
    ambar: { fondo: '#FEF3E2', texto: '#92400E' },
    neutro: { fondo: '#F1F4F3', texto: TINTA },
  };
  const p = paletas[tono] ?? paletas.teal;
  return `<a href="${escapar(url)}" style="display:inline-block;padding:9px 18px;border-radius:6px;background-color:${p.fondo};color:${p.texto};font-family:${FONT};font-size:13px;font-weight:700;text-decoration:none;">${escapar(texto)}</a>`;
}

function chips(links) {
  // El separador va antes de cada enlace y envuelto con él en un span nowrap:
  // así el «·» nunca queda solo al final de una línea cuando hay salto.
  return links.map((l, i) => {
    const enlace = `<a href="${escapar(l.url)}" style="font-family:${FONT};font-size:13px;font-weight:600;color:${ACENTO};text-decoration:none;margin-right:2px;">${escapar(l.texto)} ↗</a>`;
    return i ? `<span style="white-space:nowrap;"><span style="color:#C9C5D2;">·</span> ${enlace}</span>` : enlace;
  }).join(' ');
}

function pill(texto) {
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background-color:#EEF4F2;color:#4E6F68;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${escapar(texto)}</span>`;
}

/* ── bloques ────────────────────────────────────────────────────────────── */

function bloqueHero(datos, asset) {
  const bajada = (datos.hero.bajada ?? [])
    .map(p => `<p style="margin:14px 0 0 0;font-family:${FONT};font-size:16px;line-height:1.65;color:${SUAVE};">${formato(p)}</p>`)
    .join('\n            ');
  const auspicio = datos.hero.auspicio ?? null;
  const bloque = auspicio
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0 0;background-color:#FEF9F2;border:1px solid #F2E4CD;border-radius:6px;">
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0;font-family:${MONO};font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#92400E;font-weight:700;">${escapar(auspicio.texto)}</p>
                  <p style="margin:6px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${SUAVE};">${escapar(auspicio.detalle)} · <a href="${escapar(auspicio.url)}" style="color:#92400E;text-decoration:none;font-weight:600;">empresas.devschile.cl →</a></p>
                </td>
              </tr>
            </table>`
    : '';
  const header = auspicio
    ? `<a href="${escapar(auspicio.url)}" style="color:#92400E;text-decoration:none;font-weight:700;">Auspicia esta edición →</a>`
    : '';
  return { bajada, bloque, header };
}

function bloqueDestacados(destacados, asset) {
  return (destacados ?? []).map(d => `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:16px 0;border-bottom:1px solid ${BORDE};">
              <tr>
                <td valign="top" style="width:96px;padding:2px 16px 0 0;">
                  <a href="${escapar(d.url)}" style="text-decoration:none;"><img src="${escapar(asset(d.imagen))}" alt="${escapar(d.titulo)}" width="96" height="96" style="display:block;width:96px;height:96px;border:1px solid ${BORDE};border-radius:8px;object-fit:cover;"></a>
                </td>
                <td valign="top">
                  <p style="margin:0 0 5px 0;">${pill(d.tema)}</p>
                  <h3 style="margin:0;font-family:${FONT};font-size:17px;line-height:1.3;letter-spacing:-0.01em;font-weight:800;color:${TINTA};"><a href="${escapar(d.url)}" style="color:${TINTA};text-decoration:none;">${escapar(d.titulo)} <span style="color:${ACENTO};font-weight:700;">↗</span></a></h3>
                  <p style="margin:6px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${SUAVE};">${formato(d.descripcion)}</p>
                  ${por(d.por)}
                </td>
              </tr>
            </table>`).join('\n');
}

function bloqueProyectos(proyectos, asset) {
  if (!proyectos) return '';
  return `
        <tr>
          <td style="padding:26px 28px 0 28px;">
            <h2 style="margin:0 0 2px 0;font-family:${FONT};font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${TINTA};"><span style="border-bottom:3px solid ${LINEA};padding-bottom:4px;">${escapar(proyectos.titulo)}</span></h2>
            <p style="margin:12px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${SUAVE};">${escapar(proyectos.intro)}</p>
            ${proyectos.items.map(p => `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0 0;background-color:#F2FBF9;border:1px solid #CBEAE4;border-radius:8px;">
              <tr>
                <td style="padding:16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td valign="top" style="width:72px;padding:0 14px 0 0;">
                        <a href="${escapar(p.url)}" style="text-decoration:none;"><img src="${escapar(asset(p.imagen))}" alt="${escapar(p.titulo)}" width="72" height="72" style="display:block;width:72px;height:72px;border:1px solid #CBEAE4;border-radius:8px;object-fit:cover;"></a>
                      </td>
                      <td valign="top">
                        <h3 style="margin:0;font-family:${FONT};font-size:17px;font-weight:800;letter-spacing:-0.01em;color:${TINTA};"><a href="${escapar(p.url)}" style="color:${TINTA};text-decoration:none;">${escapar(p.titulo)} <span style="color:#0A6B60;">↗</span></a></h3>
                        <p style="margin:5px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${SUAVE};">${formato(p.descripcion)}</p>
                        ${por(p.por)}
                      </td>
                    </tr>
                  </table>
                  <p style="margin:12px 0 0 0;">${boton(p.cta, p.url, 'teal')}</p>
                </td>
              </tr>
            </table>`).join('\n')}
          </td>
        </tr>`;
}

function bloqueComunidad(comunidad, asset) {
  if (!comunidad) return '';
  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 6px 0;background-color:#F2FBF9;border:1px solid #CBEAE4;border-radius:8px;">
              <tr>
                <td style="padding:18px 18px 16px 18px;">
                  <p style="margin:0;font-family:${MONO};font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#0A6B60;font-weight:700;">${escapar(comunidad.etiqueta)}</p>
                  ${comunidad.imagen ? `<a href="${escapar(comunidad.url)}" style="text-decoration:none;display:block;margin:10px 0 14px 0;"><img src="${escapar(asset(comunidad.imagen))}" alt="${escapar(comunidad.titulo)}" width="508" style="display:block;width:100%;max-width:508px;height:auto;border:1px solid #CBEAE4;border-radius:6px;"></a>` : ''}
                  <h3 style="margin:0;font-family:${FONT};font-size:19px;line-height:1.3;letter-spacing:-0.02em;font-weight:800;color:${TINTA};">${escapar(comunidad.titulo)}</h3>
                  <p style="margin:8px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${SUAVE};">${formato(comunidad.descripcion)}</p>
                  ${por(comunidad.por)}
                  <p style="margin:14px 0 0 0;">${boton(comunidad.cta, comunidad.url, 'teal')}</p>
                </td>
              </tr>
            </table>`;
}

function bloqueSecciones(secciones) {
  return (secciones ?? []).map(s => `
        <tr>
          <td style="padding:24px 28px 0 28px;">
            <h2 style="margin:0 0 2px 0;font-family:${FONT};font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${TINTA};"><span style="border-bottom:3px solid ${LINEA};padding-bottom:4px;">${escapar(s.tema)}</span></h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0 0;">
              ${s.items.map(item => {
                const principal = item.links?.[0]?.url;
                const titulo = principal
                  ? `<a href="${escapar(principal)}" style="color:${TINTA};text-decoration:none;">${escapar(item.titulo)} <span style="color:${ACENTO};font-weight:700;">↗</span></a>`
                  : escapar(item.titulo);
                const extra = (item.links ?? []).slice(1);
                return `<tr>
                <td style="padding:0 0 18px 0;">
                  <p style="margin:0;font-family:${FONT};font-size:16px;line-height:1.4;font-weight:700;letter-spacing:-0.01em;color:${TINTA};">${titulo}</p>
                  <p style="margin:5px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${SUAVE};">${formato(item.descripcion)}</p>
                  ${extra.length ? `<p style="margin:4px 0 0 0;">${chips(extra)}</p>` : ''}
                  ${por(item.por)}
                </td>
              </tr>`;
              }).join('\n              ')}
            </table>
          </td>
        </tr>`).join('\n');
}

function bloqueCompactos(compactos) {
  if (!compactos) return '';
  return `
            <h2 style="margin:10px 0 12px 0;font-family:${FONT};font-size:16px;font-weight:800;letter-spacing:-0.01em;color:${TINTA};">${escapar(compactos.titulo)} <span style="color:${SUAVE};font-weight:500;">— lo que quedó dando vueltas</span></h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDE};">
              ${compactos.items.map(item => `<tr>
                <td style="padding:9px 0;border-bottom:1px solid ${BORDE};">
                  <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.5;color:${SUAVE};"><a href="${escapar(item.url)}" style="color:${TINTA};text-decoration:none;font-weight:600;">${escapar(item.titulo)} <span style="color:${ACENTO};">↗</span></a></p>
                </td>
              </tr>`).join('\n              ')}
            </table>`;
}

function bloquePegas(pegas) {
  if (!pegas) return '';
  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 0 0;background-color:#FEF9F2;border:1px solid #F2E4CD;border-radius:8px;">
              <tr>
                <td style="padding:18px;">
                  <h3 style="margin:0;font-family:${FONT};font-size:17px;font-weight:800;letter-spacing:-0.01em;color:${TINTA};"><span style="border-bottom:3px solid #B45309;padding-bottom:3px;">${escapar(pegas.titulo)}</span></h3>
                  <p style="margin:12px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${SUAVE};">${formato(pegas.intro)}</p>
                  ${(pegas.destacadas ?? []).map(p => `<p style="margin:10px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${SUAVE};"><a href="${escapar(p.url)}" style="color:${TINTA};font-weight:700;text-decoration:underline;">${escapar(p.titulo)}</a> · ${escapar(p.empresa)} · ${escapar(p.detalle)} <span style="display:inline-block;margin-left:4px;padding:1px 8px;border-radius:999px;background-color:#E7F5EC;color:#146B3A;font-size:11px;font-weight:700;">${escapar(p.sueldo)}</span></p>`).join('\n                  ')}
                  <p style="margin:16px 0 0 0;">${boton(pegas.cta, pegas.url, 'ambar')}</p>
                </td>
              </tr>
            </table>`;
}

function bloqueProyectoCierre(proyectoData) {
  if (!proyectoData) return '';
  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDE};border-radius:8px;">
              <tr>
                <td style="padding:16px 18px;">
                  <p style="margin:0;font-family:${MONO};font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#7A7688;font-weight:700;">${escapar(proyectoData.etiqueta)}</p>
                  <h3 style="margin:7px 0 0 0;font-family:${FONT};font-size:18px;font-weight:800;letter-spacing:-0.02em;color:${TINTA};">${escapar(proyectoData.titulo)}</h3>
                  <p style="margin:6px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${SUAVE};">${formato(proyectoData.descripcion)}</p>
                  <p style="margin:14px 0 0 0;">${boton(proyectoData.cta, proyectoData.url, 'neutro')}</p>
                </td>
              </tr>
            </table>`;
}

/* ── UTM (solo correo) ──────────────────────────────────────────────────── */

function agregarUtmFuente(href) {
  const indiceFragmento = href.indexOf('#');
  const sinFragmento = indiceFragmento === -1 ? href : href.slice(0, indiceFragmento);
  const fragmento = indiceFragmento === -1 ? '' : href.slice(indiceFragmento);
  const indiceQuery = sinFragmento.indexOf('?');
  const base = indiceQuery === -1 ? sinFragmento : sinFragmento.slice(0, indiceQuery);
  const query = indiceQuery === -1 ? '' : sinFragmento.slice(indiceQuery + 1);
  const parametros = query
    ? query.replaceAll('&amp;', '&').split('&').filter(parametro => !/^utm_source=/i.test(parametro))
    : [];

  parametros.push(`utm_source=${UTM_SOURCE}`);
  return `${base}?${parametros.join('&amp;')}${fragmento}`;
}

export function agregarUtmALinks(html) {
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (_, href) => `href="${agregarUtmFuente(href)}"`);
}

/* ── versión texto (alternativa plain-text del correo) ──────────────────── */

const sinFormato = s => String(s ?? '')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/<[^>]+>/g, '');

/**
 * Versión texto del correo, generada del mismo JSON para que la alternativa
 * plain-text diga lo mismo que el HTML (enviar.mjs la usa si existe).
 */
export function textoPlano(datos, { fecha, numero } = {}) {
  const { rango, anio } = fechas(fecha);
  const lineas = [
    `SEMANARIO devsChile — #${numero} · ${rango} de ${anio}`,
    '',
    sinFormato(datos.hero.titulo),
    '',
    ...(datos.hero.bajada ?? []).map(sinFormato),
    '',
    'LO MÁS COMENTADO',
  ];
  for (const d of datos.destacados ?? []) {
    lineas.push(`· ${sinFormato(d.titulo)} — ${sinFormato(d.descripcion)}`, `  ${d.url}`);
    if (d.por) lineas.push(`  compartido por ${d.por}`);
  }
  if (datos.comunidad) {
    lineas.push('', datos.comunidad.etiqueta.toUpperCase(), sinFormato(datos.comunidad.titulo),
      sinFormato(datos.comunidad.descripcion), `  ${datos.comunidad.url}`);
    if (datos.comunidad.por) lineas.push(`  compartido por ${datos.comunidad.por}`);
  }
  if (datos.proyectos) {
    lineas.push('', datos.proyectos.titulo.toUpperCase());
    for (const p of datos.proyectos.items) {
      lineas.push(`· ${sinFormato(p.titulo)} — ${sinFormato(p.descripcion)}`, `  ${p.url}`);
      if (p.por) lineas.push(`  compartido por ${p.por}`);
    }
  }
  for (const s of datos.secciones ?? []) {
    lineas.push('', s.tema.toUpperCase());
    for (const item of s.items) {
      lineas.push(`· ${sinFormato(item.titulo)} — ${sinFormato(item.descripcion)}`);
      for (const l of item.links ?? []) lineas.push(`  ${l.texto}: ${l.url}`);
      if (item.por) lineas.push(`  compartido por ${item.por}`);
    }
  }
  if (datos.compactos) {
    lineas.push('', `${datos.compactos.titulo} — lo que quedó dando vueltas`);
    for (const item of datos.compactos.items) lineas.push(`· ${sinFormato(item.titulo)}`, `  ${item.url}`);
  }
  if (datos.pegas) {
    lineas.push('', datos.pegas.titulo.toUpperCase(), sinFormato(datos.pegas.intro));
    for (const p of datos.pegas.destacadas ?? []) {
      lineas.push(`· ${sinFormato(p.titulo)} · ${p.empresa} · ${p.detalle} · ${p.sueldo}`, `  ${p.url}`);
    }
    lineas.push(`  ${datos.pegas.cta} ${datos.pegas.url}`);
  }
  lineas.push('', datos.cierre?.texto ?? 'Nos leemos la próxima semana.');
  if (datos.cierre?.proyecto) {
    const p = datos.cierre.proyecto;
    lineas.push('', `${p.etiqueta}: ${p.titulo}`, sinFormato(p.descripcion), `  ${p.url}`);
  }
  return `${lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/* ── render ─────────────────────────────────────────────────────────────── */

/**
 * Devuelve el HTML completo de la edición.
 * @param {{ fecha: string, modo?: 'web'|'correo', raiz?: string, siteUrl?: string, assetsBase?: string }} opciones
 */
export async function renderPropuesta({ fecha, modo = 'web', raiz, siteUrl, assetsBase } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) {
    throw new Error('Uso: node scripts/generar_propuesta.mjs|generar_correo.mjs YYYY-MM-DD');
  }
  const root = path.resolve(raiz ?? process.env.SEMANARIO_ROOT ?? path.resolve(import.meta.dirname, '..', '..'));
  const site = (siteUrl ?? process.env.SITE_URL ?? 'https://semanario.devschile.cl').replace(/\/$/, '');
  const baseAssets = assetsBase ?? process.env.ASSETS_BASE ?? '';
  const dir = path.join(root, 'ediciones', fecha);
  const datos = JSON.parse(await readFile(path.join(dir, 'propuesta.json'), 'utf8'));
  let html = await readFile(path.join(root, 'template-propuesta.html'), 'utf8');

  const asset = valor => urlAsset(valor, { siteUrl: site, fecha, assetsBase: baseAssets });
  const { rango, anio, fechaLarga } = fechas(fecha);
  const numero = await numeroEdicion(root, fecha);

  const hero = bloqueHero(datos, asset);

  const preheader = `${datos.destacados?.[0]?.titulo ?? 'El Semanario'} y ${datos.compactos?.items?.length ?? 0} links más de la semana en devsChile`;

  const totalLinks = (datos.destacados?.length ?? 0)
    + (datos.proyectos?.items?.length ?? 0)
    + (datos.comunidad ? 1 : 0)
    + (datos.secciones ?? []).reduce((n, s) => n + s.items.reduce((m, it) => m + (it.links?.length ?? 0), 0), 0)
    + (datos.compactos?.items?.length ?? 0);
  const statsHero = [
    `${totalLinks} links`,
    `${(datos.secciones ?? []).length} temas`,
    datos.pegas?.total ? `${datos.pegas.total} pegas nuevas` : '',
  ].filter(Boolean).join(' · ');

  // En el correo, el pie cierra con «Ver la versión web» y el link de baja por
  // destinatario; en la web solo queda el marcador (comentario invisible).
  // El «·» del link de baja lo aporta enviar.mjs al reemplazar el marcador.
  const footerLinks = modo === 'correo'
    ? ' · <!--VER_HTML--> <!-- BAJA_LINK -->'
    : ' <!-- BAJA_LINK -->';

  const reemplazos = {
    '{{LOGO}}': asset('assets-propuesta/logo.png'),
    '{{PREHEADER}}': escapar(preheader),
    '{{TITULO}}': `Semanario devsChile — edición del ${rango} de ${anio}`,
    '{{NUMERO}}': String(numero),
    '{{FECHA}}': fecha,
    '{{SITE_URL}}': site,
    '{{FECHA_LARGA}}': fechaLarga,
    '{{RANGO}}': rango,
    '{{AUSPICIO_HEADER}}': hero.header,
    '{{AUSPICIO_BLOQUE}}': hero.bloque,
    '{{HERO_TITULO}}': escapar(datos.hero.titulo),
    '{{HERO_BAJADA}}': hero.bajada,
    '{{HERO_STATS}}': escapar(statsHero),
    '{{DESTACADOS}}': bloqueDestacados(datos.destacados, asset),
    '{{PROYECTOS}}': bloqueProyectos(datos.proyectos, asset),
    '{{COMUNIDAD}}': bloqueComunidad(datos.comunidad, asset),
    '{{SECCIONES}}': bloqueSecciones(datos.secciones),
    '{{COMPACTOS}}': bloqueCompactos(datos.compactos),
    '{{PEGAS}}': bloquePegas(datos.pegas),
    '{{CIERRE}}': escapar(datos.cierre?.texto ?? ''),
    '{{PROYECTO}}': bloqueProyectoCierre(datos.cierre?.proyecto),
    '{{FOOTER_LINKS}}': footerLinks,
  };

  for (const [clave, valor] of Object.entries(reemplazos)) html = html.split(clave).join(valor);

  const pendientes = [...html.matchAll(/{{[A-Z_]+}}/g)].map(m => m[0]);
  if (pendientes.length) throw new Error(`Quedaron marcadores sin reemplazar: ${[...new Set(pendientes)].join(', ')}`);

  if (modo === 'correo') html = agregarUtmALinks(html);

  return { html, numero, rango, fechaLarga, datos, archivo: modo === 'correo' ? 'newsletter.html' : 'propuesta.html' };
}
