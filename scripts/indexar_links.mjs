#!/usr/bin/env node
/**
 * 🔎 Genera ediciones/YYYY-MM-DD/links.json desde el resumen.md de la edición.
 *
 * Uso:
 *   node scripts/indexar_links.mjs YYYY-MM-DD
 *
 * Deja cada link con `tags: []` para que el bot los complete con tags de
 * scripts/tags.json. Si links.json ya existe, conserva los tags que tenga cada
 * URL, así se puede volver a correr después de editar el resumen sin perderlos.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { aplicarTags, extraerLinks } from './lib/indice-links.mjs';

const fecha = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) {
  throw new Error('Uso: node scripts/indexar_links.mjs YYYY-MM-DD');
}
const raiz = path.resolve(process.env.SEMANARIO_ROOT ?? path.resolve(import.meta.dirname, '..'));
const dir = path.join(raiz, 'ediciones', fecha);
const destino = path.join(dir, 'links.json');

const vocabulario = JSON.parse(await readFile(path.join(import.meta.dirname, 'tags.json'), 'utf8'));
const md = await readFile(path.join(dir, 'resumen.md'), 'utf8');
const previo = existsSync(destino) ? JSON.parse(await readFile(destino, 'utf8')) : null;

const { links, avisos } = aplicarTags(extraerLinks(md), previo, vocabulario);
for (const aviso of avisos) console.warn(`⚠ ${aviso}`);

await writeFile(destino, `${JSON.stringify({ edicion: fecha, links }, null, 2)}\n`);
const sinTags = links.filter((link) => !link.tags.length).length;
console.log(`✔ ediciones/${fecha}/links.json — ${links.length} links, ${sinTags} sin tags`);
