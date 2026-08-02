import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Validación deliberadamente laxa: la verdad sobre si un correo existe la da
// el mail de confirmación, no una regex.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254; // RFC 5321

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export default async (request, context) => {
  if (request.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }

  const email = String(payload?.email ?? '').trim().toLowerCase();

  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
    return json({ error: 'Correo inválido' }, 400);
  }

  const source = String(payload?.source ?? 'landing').slice(0, 100);
  const referrer = (request.headers.get('referer') ?? '').slice(0, 500) || null;
  const ip = context.ip ?? request.headers.get('x-nf-client-connection-ip') ?? null;

  try {
    // Un solo round-trip. Si el correo ya existía:
    //   - estaba dado de baja  → vuelve a 'pending' con un token nuevo
    //   - estaba pending/confirmed → se deja tal cual (idempotente)
    // `xmax = 0` es el truco estándar de Postgres para distinguir un INSERT
    // real de un UPDATE en una sentencia con ON CONFLICT.
    const [row] = await sql`
      INSERT INTO subscribers (email, source, referrer, ip)
      VALUES (${email}, ${source}, ${referrer}, ${ip})
      ON CONFLICT (email) DO UPDATE SET
        status = CASE
          WHEN subscribers.status = 'unsubscribed' THEN 'pending'
          ELSE subscribers.status
        END,
        confirm_token = CASE
          WHEN subscribers.status = 'unsubscribed' THEN gen_random_uuid()
          ELSE subscribers.confirm_token
        END,
        unsubscribed_at = CASE
          WHEN subscribers.status = 'unsubscribed' THEN NULL
          ELSE subscribers.unsubscribed_at
        END
      RETURNING id, status, confirm_token, (xmax = 0) AS is_new
    `;

    // TODO(email): mandar el correo de confirmación con este link.
    // Mientras no haya proveedor configurado, queda en el log de la función.
    if (row.status === 'pending') {
      const confirmUrl = `${process.env.SITE_URL ?? ''}/api/confirmar?token=${row.confirm_token}`;
      console.log(`[semanario] confirmación pendiente para ${email}: ${confirmUrl}`);
    }

    // Respuesta siempre igual, exista o no el correo en la base: si dijéramos
    // "ya estás suscrito" cualquiera podría usar el formulario para averiguar
    // quién está en la lista.
    return json({ ok: true });
  } catch (error) {
    console.error('[semanario] error al suscribir:', error);
    return json({ error: 'No pudimos procesar la suscripción' }, 500);
  }
};

export const config = {
  path: '/api/subscribe',
};
