"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { OPEN_PREFERENCES_EVENT, readConsent, writeConsent, type ConsentChoice } from "@/lib/consent";

import { Sheet } from "./Sheet";

/** rutas que se muestran dentro de la página de otro (o para capturas): no llevan aviso */
const SILENT = ["/embed", "/render"];
/** rutas con una barra fija abajo: el aviso va arriba para no taparla */
const TOP = ["/demo"];

/**
 * Aviso de cookies: discreto, sin tapar la página ni frenar la navegación.
 * Aceptar y rechazar pesan lo mismo. Lo opcional arranca apagado.
 */
export function CookieConsent() {
  const pathname = usePathname() ?? "/";
  // null: todavía no se sabe (primer dibujo); así no parpadea para quien ya eligió
  const [pending, setPending] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState(false);
  const [choice, setChoice] = useState<ConsentChoice>({ analytics: false, marketing: false });

  useEffect(() => {
    const current = readConsent();
    setPending(current === null);
    if (current) setChoice({ analytics: current.analytics, marketing: current.marketing });
    const open = () => {
      const c = readConsent();
      if (c) setChoice({ analytics: c.analytics, marketing: c.marketing });
      setPrefs(true);
    };
    window.addEventListener(OPEN_PREFERENCES_EVENT, open);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, open);
  }, []);

  const save = (next: ConsentChoice) => {
    const consent = writeConsent(next);
    setChoice(next);
    setPending(false);
    setPrefs(false);
    // constancia de la elección: sin datos de la persona, solo el registro
    void api("/api/consent", { body: { id: consent.id, version: consent.version, analytics: consent.analytics, marketing: consent.marketing }, keepalive: true }).catch(() => {});
  };

  if (SILENT.some((p) => pathname.startsWith(p))) return null;
  const top = TOP.some((p) => pathname.startsWith(p));

  return (
    <>
      {pending && !prefs && (
        <section
          aria-label="Aviso de cookies"
          className={`toast fixed z-[45] mx-auto w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-line bg-surface p-4 shadow-[0_12px_40px_rgb(17_18_20/0.14)] sm:w-full ${
            top ? "left-3 right-3 top-3 sm:left-auto sm:right-4 sm:top-4" : "bottom-3 left-3 right-3 sm:bottom-5 sm:left-5 sm:right-auto"
          }`}
        >
          <p className="text-sm leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">Cookies.</span> MEDIDA guarda en tu dispositivo lo necesario para funcionar. Con tu permiso, además cuenta de forma
            anónima qué botones de contacto se usan.{" "}
            <Link href="/cookies/" className="underline underline-offset-2 hover:text-ink">
              Más información
            </Link>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => save({ analytics: true, marketing: true })}>
              Aceptar
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => save({ analytics: false, marketing: false })}>
              Rechazar
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPrefs(true)}>
              Personalizar
            </button>
          </div>
        </section>
      )}

      {prefs && (
        <Sheet title="Preferencias de cookies" onClose={() => setPrefs(false)}>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Elegí qué puede guardar MEDIDA en tu dispositivo. Podés cambiarlo cuando quieras desde el pie de cualquier página.
          </p>
          <ul className="mt-5 divide-y divide-line border-y border-line">
            <Row
              title="Necesarias"
              body="Mantienen tu sesión iniciada, guardan tus diseños en este dispositivo y recuerdan esta elección. Sin esto el sitio no funciona."
              checked
              locked
            />
            <Row
              title="Medición"
              body="Cuenta de forma anónima cuántas veces se toca cada botón de contacto, para saber qué parte del sitio sirve. No te identifica ni sigue tu navegación."
              checked={choice.analytics}
              onChange={(analytics) => setChoice((c) => ({ ...c, analytics }))}
            />
            <Row
              title="Publicidad"
              body="Hoy MEDIDA no usa cookies publicitarias. Guardamos tu elección para respetarla si en el futuro se suman."
              checked={choice.marketing}
              onChange={(marketing) => setChoice((c) => ({ ...c, marketing }))}
            />
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => save(choice)}>
              Guardar preferencias
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => save({ analytics: false, marketing: false })}>
              Rechazar opcionales
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

function Row({ title, body, checked, locked, onChange }: { title: string; body: string; checked: boolean; locked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <li>
      <label className={`flex items-start justify-between gap-5 py-4 ${locked ? "" : "cursor-pointer"}`}>
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-1 block text-sm leading-relaxed text-ink-2">{body}</span>
        </span>
        <span className="relative mt-0.5 inline-flex shrink-0">
          <input type="checkbox" className="peer sr-only" checked={checked} disabled={locked} onChange={(e) => onChange?.(e.target.checked)} />
          <span className={`h-6 w-11 rounded-full bg-line transition-colors duration-300 peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50 ${locked ? "opacity-50" : ""}`} />
          <span className="toggle-knob absolute left-0.5 top-0.5 size-5 rounded-full bg-surface shadow-sm peer-checked:translate-x-5" />
        </span>
      </label>
    </li>
  );
}
