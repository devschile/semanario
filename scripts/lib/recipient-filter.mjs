/**
 * Restringe la lista a emails solicitados por operador, sin alterar su orden.
 * Un filtro vacío conserva todos los destinatarios.
 */
export function filtrarDestinatarios(lista, filtro = '') {
  const solicitados = new Set(
    filtro
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

  if (!solicitados.size) return lista;
  return lista.filter((suscriptor) => solicitados.has(suscriptor.email.toLowerCase()));
}
