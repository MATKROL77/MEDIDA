/**
 * Preferencias de cookies y almacenamiento opcional.
 *
 * Lo necesario (la sesión, los diseños guardados en el dispositivo, esta misma
 * elección) no se pregunta. Lo opcional está apagado hasta que la persona lo
 * acepta, y rechazarlo no limita nada del sitio.
 */

/** cambia cuando cambia la política: una versión nueva vuelve a preguntar */
export const CONSENT_VERSION = "2026-11";

export const CONSENT_KEY = "medida.consent";
export const CONSENT_EVENT = "medida:consent";

export type ConsentChoice = {
  /** medición anónima de uso: qué botones de contacto se tocan */
  analytics: boolean;
  /** publicidad: hoy no se usa; se guarda para respetarla si se suma */
  marketing: boolean;
};

export type Consent = ConsentChoice & {
  /** identificador al azar del registro: no identifica a la persona */
  id: string;
  version: string;
  /** cuándo se eligió, en milisegundos */
  at: number;
};

export function parseConsent(raw: string | null): Consent | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<Consent>;
    if (c.version !== CONSENT_VERSION || typeof c.id !== "string" || typeof c.at !== "number") return null;
    return { id: c.id, version: c.version, at: c.at, analytics: c.analytics === true, marketing: c.marketing === true };
  } catch {
    return null;
  }
}

export function makeConsent(choice: ConsentChoice, previous: Consent | null, now: number, newId: () => string): Consent {
  return { id: previous?.id ?? newId(), version: CONSENT_VERSION, at: now, analytics: choice.analytics, marketing: choice.marketing };
}

export function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
}

export function writeConsent(choice: ConsentChoice): Consent {
  const consent = makeConsent(choice, readConsent(), Date.now(), () => crypto.randomUUID());
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    // sin almacenamiento (modo privado estricto) la elección vale para esta visita
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }));
  return consent;
}

export const allowsAnalytics = (): boolean => readConsent()?.analytics === true;

/** abre el diálogo de preferencias desde cualquier lugar (el pie de página, la política) */
export const OPEN_PREFERENCES_EVENT = "medida:cookie-preferences";
export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
}
