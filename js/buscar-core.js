/**
 * Lógica pura del buscador (sin DOM), para poder probarla con node --test.
 * La usa js/buscar.js en el navegador.
 */

/** Minúsculas y sin tildes: "Código" y "codigo" son la misma búsqueda. */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Mismo criterio que scripts/lib/indice-links.mjs: solo http(s). */
export function urlSegura(valor) {
  try {
    const url = new URL(valor);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function dominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Deja cada link listo para buscar: descarta URLs no seguras y precalcula el
 * texto normalizado (título, contexto, URL, canal y nombre de los tags).
 */
export function prepararIndice(datos) {
  const tags = datos?.tags ?? {};
  const ediciones = new Map((datos?.ediciones ?? []).map((ed) => [ed.fecha, ed]));
  const links = [];

  for (const link of datos?.links ?? []) {
    const url = urlSegura(link.url);
    if (!url) continue;
    const etiquetas = (link.tags ?? []).filter((tag) => Object.hasOwn(tags, tag));
    links.push({
      ...link,
      url,
      tags: etiquetas,
      dominio: dominio(url),
      _titulo: normalizar(link.titulo),
      _texto: normalizar([link.titulo, link.contexto, url, link.canal, ...etiquetas.map((t) => tags[t])].join(' ')),
    });
  }

  return { tags, ediciones, links };
}

/** Cuántos links tiene cada valor de `campo` (canal o tags), de mayor a menor. */
export function contar(links, campo) {
  const conteo = new Map();
  for (const link of links) {
    for (const valor of [link[campo]].flat()) {
      if (valor) conteo.set(valor, (conteo.get(valor) ?? 0) + 1);
    }
  }
  return [...conteo].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * Filtra por texto (todas las palabras deben aparecer), canal y tag. Los que
 * calzan en el título van primero; dentro de eso, la edición más reciente.
 */
export function buscar(indice, { q = '', canal = '', tag = '' } = {}) {
  const terminos = normalizar(q).split(/\s+/).filter(Boolean);

  return indice.links
    .filter((link) =>
      (!canal || link.canal === canal)
      && (!tag || link.tags.includes(tag))
      && terminos.every((t) => link._texto.includes(t)))
    .map((link) => ({ link, enTitulo: terminos.some((t) => link._titulo.includes(t)) }))
    .sort((a, b) => Number(b.enTitulo) - Number(a.enTitulo) || b.link.edicion.localeCompare(a.link.edicion))
    .map(({ link }) => link);
}
