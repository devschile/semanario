/**
 * Envío de correos transaccionales vía la API HTTP de Mailgun.
 * No usamos el SDK oficial: es un solo endpoint, no vale la pena la dependencia.
 */
const REGIONES = {
  us: 'https://api.mailgun.net',
  eu: 'https://api.eu.mailgun.net',
};

function requerido(nombre) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

/**
 * @param {{to: string, subject: string, html: string, text: string}} params
 */
export async function enviarCorreo({ to, subject, html, text }) {
  const apiKey = requerido('MAILGUN_API_KEY');
  const dominio = requerido('MAILGUN_DOMAIN');
  const from = requerido('MAILGUN_FROM');
  const region = (process.env.MAILGUN_REGION ?? 'us').toLowerCase();
  const base = REGIONES[region];
  if (!base) throw new Error(`MAILGUN_REGION inválida: "${region}" (usa "us" o "eu")`);

  const body = new URLSearchParams({ from, to, subject, html, text });

  const response = await fetch(`${base}/v3/${dominio}/messages`, {
    method: 'POST',
    headers: {
      // Mailgun usa HTTP Basic con "api" como usuario y la key como password.
      authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const detalle = await response.text().catch(() => '');
    throw new Error(`Mailgun respondió ${response.status}: ${detalle}`);
  }

  return response.json();
}
