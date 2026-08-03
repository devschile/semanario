/**
 * ✅ Promueve un suscriptor pendiente a confirmed — uso puntual antes del envío.
 *
 * Uso:
 *   node --env-file=.env scripts/promover.mjs <email>
 *
 * Respeta el doble opt-in: NO toca a los que estén unsubscribed, y solo
 * promueve el email indicado (nunca en masa). Sirve para el flujo
 * "agrega <email>" de la solicitud de aprobación.
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const email = (process.argv[2] ?? '').trim().toLowerCase();

if (!email) {
  console.error('Uso: node scripts/promover.mjs <email>');
  process.exit(1);
}

const [fila] = await sql`
  UPDATE subscribers
     SET status = 'confirmed'
   WHERE lower(email) = ${email}
     AND status != 'unsubscribed'
  RETURNING email
`;

if (fila) {
  console.log(`OK ${fila.email} -> confirmed`);
} else {
  console.error(`NO_ENCONTRADO ${email} (no existe o está unsubscribed)`);
  process.exit(1);
}
