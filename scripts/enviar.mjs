/**
 * 🗞️ Envío del Semanario — corre como GitHub Action el martes en la mañana.
 *
 * Flujo:
 *   1. Lee la edición más reciente de ediciones/YYYY-MM-DD/ (la pushea el bot
 *      el lunes en la noche).
 *   2. Consulta en Neon los suscriptores con status = 'confirmed'.
 *   3. Envía por Mailgun un correo por suscriptor (concurrencia 8), con:
 *        - link de baja único por destinatario (token de la base)
 *        - header List-Unsubscribe + List-Unsubscribe-Post (one-click de Gmail)
 *        - dirección física en el pie (requisito legal de envío masivo)
 *
 * Guardas:
 *   - Si la edición más reciente tiene más de 3 días, aborta: probablemente ya
 *     se envió y no queremos reenviar una edición vieja.
 *   - Un fallo de envío individual no corta la lista: se loguea y se sigue.
 *
 * Uso:
 *   DATABASE_URL=... MAILGUN_API_KEY=... MAILGUN_DOMAIN=... MAILGUN_FROM=... \
 *   SITE_URL=https://semanario.devschile.cl node scripts/enviar.mjs
 */
import { neon } from '@neondatabase/serverless';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const RAÍZ = path.resolve(import.meta.dirname, '..');
const MAX_DIAS_EDICION = 3;
const CONCURRENCIA = 8;
const DIRECCION = 'devsChile SpA · Dr. M. Barros Borgoño 71, Of. 1105, Providencia, Santiago, Chile';

const sql = neon(process.env.DATABASE_URL);
const SITE_URL = (process.env.SITE_URL ?? 'https://semanario.devschile.cl').replace(/\/+$/, '');
const DOMINIO = requerido('MAILGUN_DOMAIN');
const API_KEY = requerido('MAILGUN_API_KEY');
const FROM = requerido('MAILGUN_FROM');
const REGION = (process.env.MAILGUN_REGION ?? 'us').toLowerCase();
const BASE = REGION === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';

function requerido(nombre) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

/** Edición más reciente, con su HTML y su resumen (para la versión texto). */
async function ultimaEdicion() {
  const dir = path.join(RAÍZ, 'ediciones');
  const fechas = (await readdir(dir, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
    .map((e) => e.name)
    .sort()
    .reverse();

  if (!fechas.length) throw new Error('No hay ediciones en ediciones/');

  const fecha = fechas[0];
  const antiguedadDias = (Date.now() - new Date(`${fecha}T12:00:00Z`).getTime()) / 86_400_000;
  if (antiguedadDias > MAX_DIAS_EDICION) {
    throw new Error(
      `La edición más reciente (${fecha}) tiene ~${Math.floor(antiguedadDias)} días. ` +
        'Probablemente ya se envió — abortando para no reenviar.',
    );
  }

  const html = await readFile(path.join(dir, fecha, 'newsletter.html'), 'utf8');
  const texto = await readFile(path.join(dir, fecha, 'resumen.md'), 'utf8').catch(() => '');
  const titulo = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim() ?? 'Semanario devsChile';

  return { fecha, html, texto, titulo };
}

async function suscriptoresConfirmados() {
  return sql`
    SELECT email, unsubscribe_token
      FROM subscribers
     WHERE status = 'confirmed'
     ORDER BY created_at
  `;
}

/** Reemplaza el marcador <!-- BAJA_LINK --> del template por el link de baja. */
function inyectarBajaHtml(html, bajaUrl) {
  const link =
    `· <a href="${bajaUrl}" style="color:#2DD4BF;text-decoration:none;">` +
    'Darse de baja en un clic</a>';
  return html.replace(/<!--\s*BAJA_LINK[\s\S]*?-->/g, link);
}

function inyectarBajaTexto(texto, bajaUrl) {
  const encabezado = texto
    ? `${texto}\n\n`
    : 'Semanario devsChile — resumen semanal de la comunidad devsChile.\n\n';
  return (
    `${encabezado}¿No quieres recibir esto? Darse de baja en un clic acá:\n` +
    `${bajaUrl}\n\n${DIRECCION}\n`
  );
}

/** Un correo por suscriptor: cada uno lleva su propio header de baja. */
async function enviarUno({ to, subject, html, text, bajaUrl }) {
  const body = new URLSearchParams({
    from: FROM,
    to,
    subject,
    html,
    text,
    'h:List-Unsubscribe': `<${bajaUrl}>`,
    'h:List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  });

  const response = await fetch(`${BASE}/v3/${DOMINIO}/messages`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`api:${API_KEY}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const detalle = await response.text().catch(() => '');
    throw new Error(`Mailgun respondió ${response.status}: ${detalle.slice(0, 300)}`);
  }
}

async function enviarLista(suscriptores, htmlBase, textoBase, subject) {
  let ok = 0;
  const fallos = [];
  const cola = [...suscriptores];

  async function trabajador() {
    while (cola.length) {
      const sub = cola.shift();
      const bajaUrl = `${SITE_URL}/api/baja?token=${sub.unsubscribe_token}`;
      try {
        await enviarUno({
          to: sub.email,
          subject,
          html: inyectarBajaHtml(htmlBase, bajaUrl),
          text: inyectarBajaTexto(textoBase, bajaUrl),
          bajaUrl,
        });
        ok += 1;
      } catch (error) {
        fallos.push(sub.email);
        console.error(`[enviar] ${sub.email}:`, error.message);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));
  return { ok, fallos };
}

// ── Main ────────────────────────────────────────────────────────────────────

const edicion = await ultimaEdicion();
const lista = await suscriptoresConfirmados();

if (!lista.length) {
  console.log('Sin suscriptores confirmados — nada que enviar.');
  process.exit(0);
}

const rango = edicion.titulo.match(/edición del\s+(.+)$/i)?.[1] ?? edicion.fecha;
const subject = `📰 Semanario devsChile — edición del ${rango}`;

const { ok, fallos } = await enviarLista(lista, edicion.html, edicion.texto, subject);

const eventos = await statsEventos(lista.map((s) => s.email));
const bajas24h = await bajasRecientes();

console.log(`✔ ${ok}/${lista.length} enviados (edición ${edicion.fecha})`);
if (fallos.length) {
  console.error(`✖ Fallaron en el envío ${fallos.length}: ${fallos.join(', ')}`);
}
const p = (k) => eventos[k] ?? 0;
console.log(
  `📊 Stats (ventana 30 min): delivered=${p('delivered')} opened=${p('opened')} ` +
    `failed=${p('failed')} unsubscribed=${p('unsubscribed')} · bajas 24h=${bajas24h}`,
);
if (fallos.length) process.exitCode = 1;

/** Cuenta eventos recientes de Mailgun para los destinatarios del envío. */
async function statsEventos(recipientes) {
  const set = new Set(recipientes.map((e) => e.toLowerCase()));
  const desde = Math.floor(Date.now() / 1000) - 1800; // últimos 30 min
  const url = `${BASE}/v3/${DOMINIO}/events?begin=${desde}&ascending=yes&limit=300`;
  const response = await fetch(url, {
    headers: {
      authorization: `Basic ${Buffer.from(`api:${API_KEY}`).toString('base64')}`,
    },
  });
  if (!response.ok) return {};
  const data = await response.json();
  const conteo = {};
  for (const item of data.items ?? []) {
    if (set.has(String(item.recipient ?? '').toLowerCase()) && item.event) {
      conteo[item.event] = (conteo[item.event] ?? 0) + 1;
    }
  }
  return conteo;
}

/** Bajas registradas en Neon (vía /api/baja o one-click) en las últimas 24h. */
async function bajasRecientes() {
  const [row] = await sql`
    SELECT count(*)::int AS n
      FROM subscribers
     WHERE status = 'unsubscribed'
       AND unsubscribed_at > now() - interval '1 day'
  `;
  return row?.n ?? 0;
}
