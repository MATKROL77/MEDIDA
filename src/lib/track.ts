/**
 * Registro de intención de contacto.
 *
 * Abrir WhatsApp o el correo no es un mensaje enviado: se anota como clic, y
 * solo si la persona aceptó la medición. Sin ese permiso no sale nada del
 * navegador. No lleva identificadores ni datos de la persona.
 */

import { api } from "./api.ts";
import { allowsAnalytics } from "./consent.ts";

export type IntentEvent = {
  type: "whatsapp_click" | "email_start";
  /** qué servicio o familia le interesaba */
  interest: string;
  /** desde qué parte del sitio: "hero", "header", "servicios", "demo" */
  placement: string;
};

export function trackIntent(event: IntentEvent) {
  if (typeof window === "undefined" || !allowsAnalytics()) return;
  void api("/api/events", { body: { ...event, path: window.location.pathname }, keepalive: true }).catch(() => {
    // medir nunca puede romper un botón de contacto
  });
}
