/**
 * Semanario devsChile — "Buscar en ediciones anteriores".
 *
 * Busca en /buscar.json, el índice de links que arma scripts/build.mjs desde
 * los resumen.md de cada edición. Todo pasa en el navegador: no hay endpoint
 * ni base de datos detrás. El índice se descarga recién cuando el buscador
 * entra en pantalla o recibe foco, para no pesar en la carga de la portada.
 *
 * Todo el contenido viene de Slack, así que se inserta con textContent —
 * nunca con innerHTML — y solo se enlazan URLs http(s).
 */
import { buscar, contar, prepararIndice } from './buscar-core.js';

const POR_PAGINA = 20;

const raiz = document.getElementById('buscador');
const input = document.getElementById('buscar-q');
const selectCanal = document.getElementById('buscar-canal');
const contTags = document.getElementById('buscar-tags');
const estado = document.getElementById('buscar-estado');
const lista = document.getElementById('buscar-resultados');
const botonMas = document.getElementById('buscar-mas');

let indice = null;
let cargando = null;
let tagActivo = '';
let resultados = [];
let mostrados = 0;
let usoRegistrado = false;

// Sin JS no hay buscador: el bloque viene oculto en el HTML y se muestra acá.
raiz.hidden = false;

function el(tag, props = {}, hijos = []) {
  const nodo = Object.assign(document.createElement(tag), props);
  nodo.append(...hijos);
  return nodo;
}

function cargarIndice() {
  cargando ??= fetch('/buscar.json')
    .then((respuesta) => {
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      return respuesta.json();
    })
    .then((datos) => {
      indice = prepararIndice(datos);
      pintarFiltros();
      actualizar();
    })
    .catch(() => {
      cargando = null;
      estado.textContent = 'No pudimos cargar el buscador. Inténtalo de nuevo en un rato.';
    });
  return cargando;
}

function pintarFiltros() {
  for (const [canal, total] of contar(indice.links, 'canal')) {
    selectCanal.append(el('option', { value: canal, textContent: `${canal} (${total})` }));
  }
  // Un canal o tag que no existe en el índice (link viejo o editado) se ignora.
  selectCanal.value = new URLSearchParams(window.location.search).get('canal') ?? '';
  if (!Object.hasOwn(indice.tags, tagActivo)) tagActivo = '';

  for (const [tag, total] of contar(indice.links, 'tags')) {
    const boton = el('button', {
      type: 'button',
      className: 'chip',
      textContent: `${indice.tags[tag]} · ${total}`,
    });
    boton.dataset.tag = tag;
    boton.setAttribute('aria-pressed', String(tag === tagActivo));
    contTags.append(boton);
  }
  contTags.hidden = !contTags.childElementCount;
}

function tarjeta(link) {
  const edicion = indice.ediciones.get(link.edicion);
  const enlace = el('a', {
    href: link.url,
    target: '_blank',
    rel: 'noopener noreferrer',
    textContent: link.titulo,
  });
  enlace.dataset.canal = link.canal;
  enlace.dataset.edicion = link.edicion;

  return el('li', { className: 'card card-static resultado' }, [
    el('div', { className: 'resultado-meta' }, [
      el('span', { className: 'badge', textContent: link.canal }),
      el('a', {
        href: `/newsletter/${link.edicion}/`,
        textContent: edicion
          ? `Edición #${String(edicion.numero).padStart(2, '0')} · ${edicion.legible}`
          : `Edición del ${link.edicion}`,
      }),
    ]),
    el('h3', {}, [enlace, el('span', { className: 'resultado-dominio', textContent: link.dominio })]),
    el('p', { textContent: link.contexto }),
    ...(link.tags.length
      ? [el('p', { className: 'resultado-tags', textContent: link.tags.map((t) => `#${indice.tags[t]}`).join('  ') })]
      : []),
  ]);
}

function pintarPagina() {
  const pagina = resultados.slice(mostrados, mostrados + POR_PAGINA);
  lista.append(...pagina.map(tarjeta));
  mostrados += pagina.length;
  botonMas.hidden = mostrados >= resultados.length;
}

function actualizar() {
  if (!indice) return;

  const q = input.value.trim();
  const canal = selectCanal.value;
  const activo = Boolean(q || canal || tagActivo);

  lista.replaceChildren();
  mostrados = 0;
  resultados = activo ? buscar(indice, { q, canal, tag: tagActivo }) : [];
  lista.hidden = !resultados.length;

  if (!activo) {
    estado.textContent = '';
    botonMas.hidden = true;
    return;
  }

  estado.textContent = resultados.length
    ? `${resultados.length} ${resultados.length === 1 ? 'link encontrado' : 'links encontrados'}`
    : 'No encontramos links con esa búsqueda. Prueba con otra palabra o quita un filtro.';
  pintarPagina();

  // Solo se registra que se usó y con qué filtros, nunca el texto buscado.
  if (!usoRegistrado) {
    usoRegistrado = true;
    window.posthog?.capture('archive_search_used', {
      con_texto: Boolean(q),
      con_canal: Boolean(canal),
      con_tag: Boolean(tagActivo),
    });
  }
}

let espera;
input.addEventListener('input', () => {
  clearTimeout(espera);
  espera = setTimeout(actualizar, 150);
});
input.addEventListener('focus', cargarIndice);
selectCanal.addEventListener('change', actualizar);
selectCanal.addEventListener('focus', cargarIndice);

contTags.addEventListener('click', (event) => {
  const boton = event.target.closest('button[data-tag]');
  if (!boton) return;
  tagActivo = tagActivo === boton.dataset.tag ? '' : boton.dataset.tag;
  for (const chip of contTags.querySelectorAll('button[data-tag]')) {
    chip.setAttribute('aria-pressed', String(chip.dataset.tag === tagActivo));
  }
  actualizar();
});

botonMas.addEventListener('click', pintarPagina);

lista.addEventListener('click', (event) => {
  const enlace = event.target.closest('a[target="_blank"]');
  if (!enlace) return;
  window.posthog?.capture('archive_search_result_clicked', {
    canal: enlace.dataset.canal,
    edicion: enlace.dataset.edicion,
  });
});

// Un link tipo /?q=rust&tag=lenguajes#buscador abre con la búsqueda hecha.
const params = new URLSearchParams(window.location.search);
if (params.get('q') || params.get('canal') || params.get('tag')) {
  input.value = params.get('q') ?? '';
  tagActivo = params.get('tag') ?? '';
  cargarIndice();
} else if ('IntersectionObserver' in window) {
  const observador = new IntersectionObserver((entradas) => {
    if (entradas.some((e) => e.isIntersecting)) {
      observador.disconnect();
      cargarIndice();
    }
  }, { rootMargin: '300px' });
  observador.observe(raiz);
}
