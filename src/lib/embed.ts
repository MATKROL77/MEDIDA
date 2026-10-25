/**
 * Versión para publicar dentro de una página de Claude (`npm run artifact`).
 * Ahí no se pueden bajar archivos ni abrir el menú de compartir, y la URL de
 * la página no lleva parámetros: la configuración viaja por memoria.
 */

export const EMBEDDED = process.env.NEXT_PUBLIC_ARTIFACT === "1";

declare global {
  interface Window {
    __artifactQuery?: string;
  }
}

/** el "?c=..." actual: el de la URL, o el que dejó la navegación interna */
export function currentQuery(): string {
  if (typeof window === "undefined") return "";
  return window.__artifactQuery ?? window.location.search;
}

/** guarda la configuración en la URL cuando se puede; dentro de Claude, en memoria */
export function rememberQuery(query: string) {
  if (typeof window === "undefined") return;
  if (EMBEDDED) {
    window.__artifactQuery = query;
    return;
  }
  try {
    window.history.replaceState(null, "", query);
  } catch {
    // algunos marcos no dejan tocar la URL; el link de pedido igual lleva la configuración
  }
}
