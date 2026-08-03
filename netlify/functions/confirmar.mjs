import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cierra el double opt-in: el link que llega en el correo de confirmación. */
export default async (request) => {
  const site = process.env.SITE_URL ?? new URL(request.url).origin;
  const token = new URL(request.url).searchParams.get('token') ?? '';

  const redirect = (estado, subscriberId) => {
    const location = new URL('/', site);
    location.searchParams.set('confirmacion', estado);
    if (subscriberId) location.searchParams.set('subscriber', subscriberId);
    return Response.redirect(location, 302);
  };

  if (!UUID_RE.test(token)) return redirect('invalido');

  try {
    // Idempotente: confirmar dos veces no rompe ni pisa confirmed_at.
    const [row] = await sql`
      UPDATE subscribers
         SET status = 'confirmed',
             confirmed_at = COALESCE(confirmed_at, now()),
             unsubscribed_at = NULL
       WHERE confirm_token = ${token}
         AND status IN ('pending', 'confirmed')
      RETURNING id
    `;

    return redirect(row ? 'ok' : 'invalido', row?.id);
  } catch (error) {
    console.error('[semanario] error al confirmar:', error);
    return redirect('error');
  }
};

export const config = {
  path: '/api/confirmar',
};
