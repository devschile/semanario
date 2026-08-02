import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Baja de un click — el link que va en el pie de cada edición.
 * Se conserva la fila (no se borra) para no reenviarle a alguien que ya se
 * fue si vuelve a entrar por una lista importada.
 *
 * Soporta dos modos:
 *   GET  → redirige a la landing con ?baja=estado (clic humano)
 *   POST → responde 204/404 (one-click de Gmail/Apple vía List-Unsubscribe-Post)
 */
export default async (request) => {
  const site = process.env.SITE_URL ?? new URL(request.url).origin;
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const esPost = request.method === 'POST';

  const redirect = (estado) => Response.redirect(`${site}/?baja=${estado}`, 302);
  const respuestaPost = (status) => new Response(null, { status });

  if (!UUID_RE.test(token)) return esPost ? respuestaPost(404) : redirect('invalido');

  try {
    const [row] = await sql`
      UPDATE subscribers
         SET status = 'unsubscribed',
             unsubscribed_at = COALESCE(unsubscribed_at, now())
       WHERE unsubscribe_token = ${token}
      RETURNING id
    `;

    if (esPost) return respuestaPost(row ? 204 : 404);
    return redirect(row ? 'ok' : 'invalido');
  } catch (error) {
    console.error('[semanario] error al dar de baja:', error);
    if (esPost) return respuestaPost(500);
    return redirect('error');
  }
};

export const config = {
  path: '/api/baja',
};
