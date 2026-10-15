/**
 * Índice de links del buscador "Buscar en ediciones anteriores".
 *
 * La fuente de verdad de cada link (URL, texto y contexto) es el resumen.md de
 * la edición: se relee en cada build, así un links.json editado a mano o por el
 * bot nunca puede meter una URL que no se publicó. Lo único que aporta
 * links.json son los tags, y solo los que existen en scripts/tags.json.
 */

/** Máximo de tags por link: más que eso deja de servir como filtro. */
export const MAX_TAGS = 4;
const MAX_CONTEXTO = 320;

/** Secciones del resumen que no son canales, con el nombre que muestra el buscador. */
const SECCIONES = {
  'actividad de la comunidad': 'Actividad',
  'pegas': '#trabajos',
  '#anuncios': '#anuncios',
  'más notables': 'Más notables',
  'beneficios para la comunidad': 'Beneficios',
};

/** Devuelve la URL normalizada si es http(s); si no, null. Bloquea javascript:, data:, etc. */
export function urlSegura(valor) {
  try {
    const url = new URL(valor);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Markdown inline → texto plano: links a su texto, sin **, * ni backticks. */
function textoPlano(md) {
  return md
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function recortar(texto) {
  return texto.length > MAX_CONTEXTO ? `${texto.slice(0, MAX_CONTEXTO - 1).trimEnd()}…` : texto;
}

/**
 * Separa el resumen en bloques (cada viñeta o párrafo) con el canal al que
 * pertenecen. Los comentarios HTML (metadata SEMANARIO_*) se descartan: traen
 * URLs de imágenes y banners, no links compartidos por la comunidad.
 */
function bloques(md) {
  const lineas = md.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const salida = [];
  let seccion = '';
  let canal = null;
  let actual = null;

  let esVineta = false;

  // El párrafo de conteo de #trabajos se repite cada semana con el mismo link
  // a pegas.devschile.cl: solo las viñetas (avisos puntuales) van al índice.
  const cerrar = () => {
    if (actual && canal && (esVineta || canal !== '#trabajos')) {
      salida.push({ canal, texto: actual.join(' ') });
    }
    actual = null;
  };

  for (const linea of lineas) {
    const h2 = linea.match(/^## (.+)$/);
    const h3 = linea.match(/^### (.+)$/);
    if (h2) {
      cerrar();
      seccion = h2[1].trim().toLowerCase();
      canal = seccion === 'links de la semana' ? null : SECCIONES[seccion] ?? null;
    } else if (h3) {
      cerrar();
      if (seccion === 'links de la semana') canal = h3[1].trim().toLowerCase();
    } else if (/^- /.test(linea)) {
      cerrar();
      actual = [linea.slice(2)];
      esVineta = true;
    } else if (!linea.trim() || /^(---|#\s)/.test(linea)) {
      cerrar();
    } else {
      if (!actual) esVineta = false;
      (actual ??= []).push(linea.replace(/^>\s?/, '').trim());
    }
  }
  cerrar();
  return salida;
}

/**
 * Extrae los links de un resumen.md. Un link repetido en la misma edición
 * aparece una sola vez (gana la primera mención).
 */
export function extraerLinks(md) {
  const vistos = new Set();
  const links = [];

  for (const { canal, texto } of bloques(md)) {
    const contexto = recortar(textoPlano(texto));
    for (const [, titulo, href] of texto.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
      const url = urlSegura(href);
      if (!url || vistos.has(url)) continue;
      vistos.add(url);
      links.push({ url, titulo: textoPlano(titulo), canal, contexto });
    }
  }
  return links;
}

/**
 * Cruza los links del resumen con los tags de links.json. Devuelve los links
 * con su lista de tags (vacía si no hay) y avisos de lo que se descartó.
 */
export function aplicarTags(links, linksJson, vocabulario) {
  const avisos = [];
  const porUrl = new Map();

  for (const entrada of Array.isArray(linksJson?.links) ? linksJson.links : []) {
    const url = urlSegura(entrada?.url ?? '');
    if (!url) continue;
    const tags = (Array.isArray(entrada.tags) ? entrada.tags : [])
      .filter((tag) => {
        const valido = typeof tag === 'string' && Object.hasOwn(vocabulario, tag);
        if (!valido) avisos.push(`tag desconocido "${tag}" en ${url}`);
        return valido;
      });
    porUrl.set(url, [...new Set(tags)].slice(0, MAX_TAGS));
  }

  return {
    links: links.map((link) => ({ ...link, tags: porUrl.get(link.url) ?? [] })),
    avisos,
  };
}
