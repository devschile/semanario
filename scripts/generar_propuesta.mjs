#!/usr/bin/env node
/**
 * PROPUESTA v2 — genera `propuesta.html` (formato «leaderboard», cercano a
 * Product Hunt) a partir de:
 *   - ediciones/YYYY-MM-DD/propuesta.json  → contenido curado, sin nombres
 *     de personas, ordenado por tema y no por canal
 *   - template-propuesta.html              → maqueta
 *
 * El render vive en scripts/lib/render-propuesta.mjs: la misma maqueta
 * alimenta el correo del martes (scripts/generar_correo.mjs).
 *
 * Uso: node scripts/generar_propuesta.mjs YYYY-MM-DD
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderPropuesta } from './lib/render-propuesta.mjs';

const fecha = process.argv[2];
const raiz = path.resolve(process.env.SEMANARIO_ROOT ?? path.resolve(import.meta.dirname, '..'));

const { html, numero, archivo } = await renderPropuesta({ fecha, modo: 'web', raiz });
await writeFile(path.join(raiz, 'ediciones', fecha, archivo), html);
console.log(`✔ Generado ediciones/${fecha}/${archivo} (Semanario #${numero})`);
