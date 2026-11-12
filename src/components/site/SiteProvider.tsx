"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { api } from "@/lib/api";
import { defaultContact, isValidEmail, isValidWhatsapp, type Contact } from "@/lib/site";

/** qué servicios del servidor están encendidos en esta instalación */
export type Features = {
  /** hay un proveedor de email configurado: se puede entrar con enlace y mandar recordatorios */
  email: boolean;
  /** el servidor puede mandar notificaciones del navegador */
  push: boolean;
};

type SiteState = {
  contact: Contact;
  /** null hasta saberlo; si el servidor no contesta queda todo apagado */
  features: Features | null;
};

const initial: SiteState = { contact: defaultContact, features: null };
const SiteContext = createContext<SiteState>(initial);
const CACHE_KEY = "medida.site";
const CACHE_MS = 5 * 60 * 1000;

type PublicSite = { contact?: Partial<Contact>; features?: Partial<Features> };

function toState(data: PublicSite): SiteState {
  const c = data.contact ?? {};
  return {
    contact: {
      whatsapp: typeof c.whatsapp === "string" && isValidWhatsapp(c.whatsapp) ? c.whatsapp : defaultContact.whatsapp,
      email: typeof c.email === "string" && isValidEmail(c.email) ? c.email : defaultContact.email,
    },
    features: { email: data.features?.email === true, push: data.features?.push === true },
  };
}

/**
 * Trae del servidor el contacto vigente (el que se cargó en el panel) y qué
 * servicios están encendidos. La página ya se dibujó con los valores de
 * partida, así que si el servidor no contesta todo sigue andando.
 */
export function SiteProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SiteState>(initial);

  useEffect(() => {
    let alive = true;
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null") as { at: number; data: PublicSite } | null;
      if (cached && Date.now() - cached.at < CACHE_MS) {
        setState(toState(cached.data));
        return;
      }
    } catch {
      // caché ilegible: se vuelve a pedir
    }
    api<PublicSite>("/api/public/site")
      .then((data) => {
        if (!alive) return;
        setState(toState(data));
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
        } catch {
          // sin almacenamiento de sesión se pide en cada página
        }
      })
      .catch(() => {
        if (alive) setState((s) => ({ ...s, features: { email: false, push: false } }));
      });
    return () => {
      alive = false;
    };
  }, []);

  return <SiteContext.Provider value={state}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);

/** el panel de administración lo llama después de guardar, para que el cambio se vea ya */
export function forgetSiteCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // nada que olvidar
  }
}
