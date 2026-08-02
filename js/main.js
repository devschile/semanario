/**
 * Semanario devsChile — formulario de suscripción.
 *
 * Habla con la Netlify Function de netlify/functions/subscribe.mjs, que es
 * la única que toca Neon. La connection string vive en el servidor, nunca acá.
 */
const ENDPOINT = '/api/subscribe';

const form = document.getElementById('suscribirse');
const input = document.getElementById('email');
const msg = document.getElementById('signup-msg');
const button = form.querySelector('button[type="submit"]');

// Validación mínima en cliente; la de verdad la hace el servidor.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setMessage(text, kind) {
  msg.textContent = text;
  msg.className = 'signup-msg' + (kind ? ' is-' + kind : '');
}

input.addEventListener('input', () => {
  input.removeAttribute('aria-invalid');
  if (msg.classList.contains('is-error')) setMessage('');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = input.value.trim();

  if (!EMAIL_RE.test(email)) {
    input.setAttribute('aria-invalid', 'true');
    setMessage('Revisa el correo — no parece una dirección válida.', 'error');
    input.focus();
    return;
  }

  button.disabled = true;
  const originalLabel = button.innerHTML;
  button.textContent = 'Enviando…';
  setMessage('');

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: 'landing' }),
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);

    form.querySelector('.signup-row').hidden = true;
    setMessage('¡Listo! Revisa tu correo para confirmar la suscripción 🗞️', 'success');
  } catch (error) {
    button.disabled = false;
    button.innerHTML = originalLabel;
    setMessage('No pudimos suscribirte ahora. Inténtalo de nuevo en un rato.', 'error');
  }
});

/**
 * Los endpoints de confirmación y de baja redirigen de vuelta acá con un
 * parámetro de estado. Lo traducimos a un mensaje y limpiamos la URL.
 */
(function mostrarEstadoDeRetorno() {
  const params = new URLSearchParams(window.location.search);
  const confirmacion = params.get('confirmacion');
  const baja = params.get('baja');

  const mensajes = {
    confirmacion: {
      ok: ['¡Suscripción confirmada! Nos leemos el martes 🗞️', 'success'],
      invalido: ['Ese link de confirmación no es válido o ya se usó.', 'error'],
      error: ['Algo falló al confirmar. Escríbenos si sigue pasando.', 'error'],
    },
    baja: {
      ok: ['Listo, te sacamos de la lista. Gracias por haber estado 👋', 'success'],
      invalido: ['Ese link de baja no es válido.', 'error'],
      error: ['Algo falló al darte de baja. Escríbenos si sigue pasando.', 'error'],
    },
  };

  const entrada = confirmacion
    ? mensajes.confirmacion[confirmacion]
    : baja
      ? mensajes.baja[baja]
      : null;

  if (!entrada) return;

  const [texto, tipo] = entrada;
  setMessage(texto, tipo);
  if (tipo === 'success') form.querySelector('.signup-row').hidden = true;

  form.scrollIntoView({ block: 'center' });
  window.history.replaceState({}, '', window.location.pathname);
})();
