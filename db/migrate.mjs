/**
 * Aplica db/schema.sql contra la base de Neon.
 *
 *   npm run db:schema
 *
 * Todas las sentencias son IF NOT EXISTS, así que correrlo de nuevo no hace
 * nada. No usa psql para no depender de tenerlo instalado.
 */
import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Revisa tu .env (ver .env.example).');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const ddl = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');

// Se quitan los comentarios antes de separar por ';' — si no, un ';' dentro
// de un comentario parte una sentencia por la mitad.
const sentencias = ddl
  .split('\n')
  .filter((linea) => !linea.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

for (const sentencia of sentencias) {
  await sql.query(sentencia);
}

console.log(`✔ Esquema aplicado (${sentencias.length} sentencias).`);
