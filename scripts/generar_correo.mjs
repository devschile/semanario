#!/usr/bin/env node
/**
 * CORREO v2 — genera `newsletter.html` (el correo del martes) con la misma
 * maqueta aprobada de la propuesta: formato «leaderboard», foco en los links,
 * atribución discreta y cierre en blockquote.
 *
 * Escribe también `correo.txt`, la alternativa plain-text generada del mismo
 * JSON (enviar.mjs la prefiere sobre resumen.md).
 *
 * El HTML queda listo para que scripts/enviar.mjs inyecte el link de baja por
 * destinatario (<!-- BAJA_LINK -->) y el link a la edición publicada
 * (<!--VER_HTML-->).
 *
 * Uso: node scripts/generar_correo.mjs YYYY-MM-DD
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderPropuesta, textoPlano } from './lib/render-propuesta.mjs';

const fecha = process.argv[2];
const raiz = path.resolve(process.env.SEMANARIO_ROOT ?? path.resolve(import.meta.dirname, '..'));

const { html, numero, rango, datos, archivo } = await renderPropuesta({ fecha, modo: 'correo', raiz });

// Guardas: el correo no puede salir sin los dos puntos de salida del pie.
for (const marcador of ['<!--VER_HTML-->', '<!-- BAJA_LINK -->']) {
  if (!html.includes(marcador)) throw new Error(`Falta el marcador ${marcador} en el correo generado`);
}
// Un correo sin la dirección legal no puede salir (requisito de envío masivo).
if (!html.includes('Dr. M. Barros Borgoño 71')) throw new Error('Falta la dirección legal en el pie');

await writeFile(path.join(raiz, 'ediciones', fecha, archivo), html);
await writeFile(path.join(raiz, 'ediciones', fecha, 'correo.txt'), textoPlano(datos, { fecha, numero }));
console.log(`✔ Generado ediciones/${fecha}/${archivo} + correo.txt (Semanario #${numero} · ${rango})`);
