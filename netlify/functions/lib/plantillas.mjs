/**
 * Correos transaccionales (confirmación, baja). Reusan la paleta y estructura
 * de template.html —la plantilla del newsletter en sí— pero son piezas más
 * chicas, de un solo bloque de contenido.
 */
const ENVOLTORIO = (contenidoInterior) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#100A1C;font-family:'Fira Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<center>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#100A1C" style="background-color:#100A1C;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#150F24;border:1px solid #2A2444;border-radius:6px;overflow:hidden;">

          <tr>
            <td bgcolor="#150F24" style="background:#150F24 linear-gradient(180deg,#201E40 0%,#150F24 100%);padding:30px 32px;">
              <div style="color:#2DD4BF;font-family:'Inconsolata','Courier New',monospace;font-size:12px;letter-spacing:0.04em;">&lt;devschile/&gt;</div>
              <div style="padding-top:10px;color:#ffffff;font-family:'Inconsolata','Courier New',monospace;font-size:22px;font-weight:800;letter-spacing:-0.5px;">📰 Semanario devs<span style="color:#2DD4BF;">Chile</span></div>
            </td>
          </tr>

          ${contenidoInterior}

          <tr>
            <td bgcolor="#0B0713" style="background-color:#0B0713;border-top:1px solid #2A2444;padding:22px 32px;color:#9794A8;font-size:12px;line-height:1.7;">
              La comunidad de developers más grande de Chile ·
              <a href="https://devschile.cl" style="color:#2DD4BF;text-decoration:none;">devschile.cl</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</center>
</body>
</html>`;

const BOTON = (href, texto) => `
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;">
                <tr>
                  <td style="border-radius:999px;background-color:#2DD4BF;">
                    <a href="${href}" style="display:inline-block;padding:12px 28px;color:#06210F;font-weight:700;font-size:14px;text-decoration:none;font-family:'Fira Sans',sans-serif;">${texto}</a>
                  </td>
                </tr>
              </table>`;

/** Correo de double opt-in: se manda apenas alguien se suscribe. */
export function correoConfirmacion({ confirmUrl }) {
  const html = ENVOLTORIO(`
          <tr>
            <td style="padding:30px 32px;">
              <h1 style="margin:0 0 12px;font-size:19px;color:#ffffff;font-family:'Inconsolata','Courier New',monospace;font-weight:700;">Confirma tu suscripción</h1>
              <p style="margin:0 0 4px;font-size:14px;line-height:1.7;color:#C9C6D8;">
                Un correo por semana, los martes, con lo más útil que pasó por los canales de devsChile. Un solo paso más:
              </p>
              ${BOTON(confirmUrl, 'Confirmar mi suscripción →')}
              <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#8B87A0;">
                Si no fuiste tú, ignora este correo y no pasa nada — sin confirmar, no te llegará ninguna edición.
              </p>
            </td>
          </tr>`);

  const text = `Confirma tu suscripción al Semanario devsChile\n\nUn correo por semana, los martes, con lo más útil que pasó por los canales de devsChile.\n\nConfirma acá: ${confirmUrl}\n\nSi no fuiste tú, ignora este correo.`;

  return { subject: '🗞️ Confirma tu suscripción al Semanario devsChile', html, text };
}
