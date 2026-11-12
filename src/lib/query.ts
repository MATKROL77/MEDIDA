/** la configuración viaja en la dirección de la página (?c=...), así un enlace compartido abre el mismo diseño */

export function currentQuery(): string {
  return typeof window === "undefined" ? "" : window.location.search;
}

/** deja la dirección al día con lo que se ve, sin sumar pasos al botón Atrás */
export function rememberQuery(query: string) {
  if (typeof window === "undefined") return;
  try {
    window.history.replaceState(window.history.state, "", query);
  } catch {
    // algunos marcos no dejan tocar la dirección; el enlace de consulta igual lleva la configuración
  }
}
