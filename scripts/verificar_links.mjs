#!/usr/bin/env node
/**
 * 🔗 Verifica que TODOS los links de una edición respondan.
 *
 * Uso:
 *   node scripts/verificar_links.mjs YYYY-MM-DD
 *   node scripts/verificar_links.mjs YYYY-MM-DD --json
 *
 * Revisa las URLs del `resumen.md` (vía extraerLinks) y las de `propuesta.json`
 * (el contenido que realmente sale en el correo v2). Cada link se pide con
 * HEAD y, si el sitio no acepta HEAD, con GET (se corta al recibir headers).
 *
 * Salida: una línea por link con su estado.
 *   ok        → 2xx/3xx
 *   bloqueado → 401/403/429/999 (el sitio existe, pero nos bloquea bots)
 *   roto      → DNS, timeout, 404/410, 5xx, error de red
 *
 * Código de salida 1 si hay al menos un link roto: así el pipeline se detiene
 * antes de enviar una edición con links muertos.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const TIMEOUT_MS = Number(process.env.VERIFICAR_LINKS_TIMEOUT_MS ?? 15000);
const CONCURRENCIA = Number(process.env.VERIFICAR_LINKS_CONCURRENCIA ?? 6);
const REINTENTOS = Number(process.env.VERIFICAR_LINKS_REINTENTOS ?? 1);
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Normaliza para deduplicar: sin utm_*, sin hash, sin slash final. */
export function normalizarUrl(url) {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) u.searchParams.delete(key);
    }
    u.hash = '';
    let out = u.toString();
    if (out.endsWith('/') && u.pathname !== '/') out = out.slice(0, -1);
    return out;
  } catch {
    return url;
  }
}

/** Clasifica un status HTTP en ok | bloqueado | roto. */
export function clasificarStatus(status) {
  if (status >= 200 && status < 400) return 'ok';
  if ([401, 403, 429, 999].includes(status)) return 'bloqueado';
  return 'roto';
}

async function pedir(url, method) {
  const res = await fetch(url, {
    method,
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'user-agent': UA,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'es-CL,es;q=0.9,en;q=0.8',
    },
  });
  // No descargar el cuerpo: basta con los headers.
  try { await res.body?.cancel(); } catch { /* noop */ }
  return res;
}

/** Revisa una URL y devuelve { url, estado, status, detalle }. */
export async function verificarUrl(url) {
  let ultimoError = null;
  for (let intento = 0; intento <= REINTENTOS; intento++) {
    if (intento > 0) await new Promise((resolve) => setTimeout(resolve, 2000));
    for (const method of ['HEAD', 'GET']) {
      try {
        const res = await pedir(url, method);
        const status = res.status;
        // Algunos servidores contestan HEAD raro (405/400/501): reintentar con GET.
        if (method === 'HEAD' && [400, 405, 501].includes(status)) continue;
        return { url, estado: clasificarStatus(status), status, detalle: res.url !== url ? res.url : '' };
      } catch (error) {
        ultimoError = error;
      }
    }
  }
  const codigo = ultimoError?.cause?.code ?? ultimoError?.code ?? '';
  const detalle = ultimoError?.name === 'TimeoutError'
    ? `timeout ${TIMEOUT_MS} ms`
    : (codigo ? `${codigo}${ultimoError?.cause?.hostname ? ` ${ultimoError.cause.hostname}` : ''}` : String(ultimoError?.message ?? ultimoError));
  return { url, estado: 'roto', status: 0, detalle };
}

/** Saca todas las URLs http(s) de un texto markdown (links y URLs sueltas). */
export function extraerUrlsTexto(md) {
  const urls = new Set();
  for (const [, href] of md.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)) urls.add(href);
  for (const [suelta] of md.matchAll(/https?:\/\/[^\s<>"'`]+/g)) {
    urls.add(suelta.replace(/[.,;:]+$/, '').replace(/\)+$/, ''));
  }
  return [...urls];
}

/** Junta las URLs del resumen.md y de propuesta.json, deduplicadas. */
export async function recolectarUrls(dir) {
  const urls = [];
  const vistos = new Set();
  const agregar = (url, origen) => {
    if (!/^https?:\/\//i.test(url ?? '')) return;
    const clave = normalizarUrl(url);
    if (vistos.has(clave)) return;
    vistos.add(clave);
    urls.push({ url, origen });
  };

  const mdPath = path.join(dir, 'resumen.md');
  if (existsSync(mdPath)) {
    const md = await readFile(mdPath, 'utf8');
    for (const url of extraerUrlsTexto(md)) agregar(url, 'resumen.md');
  }

  const propuestaPath = path.join(dir, 'propuesta.json');
  if (existsSync(propuestaPath)) {
    const propuesta = JSON.parse(await readFile(propuestaPath, 'utf8'));
    const walk = (nodo) => {
      if (typeof nodo === 'string') { agregar(nodo, 'propuesta.json'); return; }
      if (Array.isArray(nodo)) { nodo.forEach(walk); return; }
      if (nodo && typeof nodo === 'object') Object.values(nodo).forEach(walk);
    };
    walk(propuesta);
  }

  return urls;
}

async function main() {
  const fecha = process.argv[2];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) {
    console.error('Uso: node scripts/verificar_links.mjs YYYY-MM-DD [--json]');
    process.exit(2);
  }
  const comoJson = process.argv.includes('--json');
  const raiz = path.resolve(process.env.SEMANARIO_ROOT ?? path.resolve(import.meta.dirname, '..'));
  const dir = path.join(raiz, 'ediciones', fecha);

  const urls = await recolectarUrls(dir);
  if (!urls.length) {
    console.error(`✖ ediciones/${fecha}: no hay links para verificar`);
    process.exit(2);
  }

  const resultados = [];
  let cursor = 0;
  const trabajadores = Array.from({ length: Math.min(CONCURRENCIA, urls.length) }, async () => {
    while (cursor < urls.length) {
      const item = urls[cursor++];
      const resultado = await verificarUrl(item.url);
      resultados.push({ ...resultado, origen: item.origen });
      if (!comoJson) {
        const icono = resultado.estado === 'ok' ? '✔' : resultado.estado === 'bloqueado' ? '•' : '✖';
        console.log(`${icono} ${resultado.estado.padEnd(9)} ${String(resultado.status).padEnd(3)} ${item.url}${resultado.detalle ? ` — ${resultado.detalle}` : ''}`);
      }
    }
  });
  await Promise.all(trabajadores);

  resultados.sort((a, b) => a.url.localeCompare(b.url));
  const rotos = resultados.filter((r) => r.estado === 'roto');
  const bloqueados = resultados.filter((r) => r.estado === 'bloqueado');

  if (comoJson) {
    console.log(JSON.stringify({ edicion: fecha, total: resultados.length, rotos, bloqueados, resultados }, null, 2));
  } else {
    console.log(`\n${resultados.length} links · ${resultados.length - rotos.length - bloqueados.length} ok · ${bloqueados.length} bloqueados (siguen vivos) · ${rotos.length} rotos`);
    for (const roto of rotos) console.log(`✖ ROTO: ${roto.url}${roto.detalle ? ` — ${roto.detalle}` : ''}`);
  }

  process.exit(rotos.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
