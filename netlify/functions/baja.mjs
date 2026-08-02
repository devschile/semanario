import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Baja de un click — el link que va en el pie de cada edición.
 * Se conserva la fila (no se borra) para no reenviarle a alguien que ya se
 * fue si vuelve a entrar por una lista importada.
 */
export default async (request) => {
  const site = process.env.SITE_URL ?? new URL(request.url).origin;
  const token = new URL(request.url).searchParams.get('token') ?? '';

  const redirect = (estado) => Response.redirect(`${site}/?baja=${estado}`, 302);

  if (!UUID_RE.test(token)) return redirect('invalido');

  try {
    const [row] = await sql`
      UPDATE subscribers
         SET status = 'unsubscribed',
             unsubscribed_at = COALESCE(unsubscribed_at, now())
       WHERE unsubscribe_token = ${token}
      RETURNING id
    `;

    return redirect(row ? 'ok' : 'invalido');
  } catch (error) {
    console.error('[semanario] error al dar de baja:', error);
    return redirect('error');
  }
};

export const config = {
  path: '/api/baja',
};
