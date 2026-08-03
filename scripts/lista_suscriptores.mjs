/**
 * 📋 Lista de suscriptores por status — para la solicitud de aprobación previa al envío.
 *
 * Uso:
 *   node --env-file=.env scripts/lista_suscriptores.mjs
 *
 * Imprime los emails agrupados por status (confirmed / pending / unsubscribed)
 * con sus conteos. Solo lectura sobre Neon.
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const filas = await sql`
  SELECT email, status
    FROM subscribers
   ORDER BY status, created_at
`;

const grupos = {};
for (const f of filas) {
  (grupos[f.status] ??= []).push(f.email);
}

const orden = ['confirmed', 'pending', 'unsubscribed'];
for (const k of orden) {
  const lista = grupos[k] ?? [];
  console.log(`${k} (${lista.length}):`);
  for (const e of lista) console.log(`  - ${e}`);
}
for (const k of Object.keys(grupos)) {
  if (!orden.includes(k)) {
    console.log(`${k} (${grupos[k].length}):`);
    for (const e of grupos[k]) console.log(`  - ${e}`);
  }
}

const total = filas.length;
console.log(`TOTAL: ${total}`);
