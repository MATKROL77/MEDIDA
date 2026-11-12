"use client";

import { useState } from "react";

import { ContactLink } from "@/components/site/ContactLink";
import { IconMail, IconWhatsapp } from "@/components/site/icons";
import { INTERESTS, type Interest } from "@/lib/site";

const OPTIONS: Interest[] = ["demostracion", "configurador", "web-configurador", "web", "plataforma"];

/**
 * Contacto comercial: sin formulario ni registro. La persona elige qué le
 * interesa y el botón abre WhatsApp o el correo con ese mensaje ya escrito.
 */
export function ContactSection({ placement = "contacto" }: { placement?: string }) {
  const [interest, setInterest] = useState<Interest>("demostracion");
  return (
    <div className="rounded-[var(--radius-tile)] bg-ink px-6 py-12 text-surface sm:px-12 sm:py-16 lg:px-16 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white/60">Contacto</p>
          <h2 className="display-lg mt-4">Pedí una demostración con tus productos.</h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/70">
            Contame qué fabricás y armo una versión de MEDIDA con tus productos para que la veas funcionando. Sin formularios y sin registrarte: me escribís y lo
            hablamos.
          </p>
        </div>

        <div>
          <p id="interes-label" className="text-sm text-white/60">
            ¿Qué te interesa?
          </p>
          <div role="group" aria-labelledby="interes-label" className="mt-3 flex flex-wrap gap-2">
            {OPTIONS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={interest === id}
                onClick={() => setInterest(id)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors duration-200 ${
                  interest === id ? "border-white bg-white text-ink" : "border-white/25 text-white/85 hover:border-white/60"
                }`}
              >
                {INTERESTS[id].label}
              </button>
            ))}
          </div>

          <p className="mt-6 rounded-2xl bg-white/[0.07] px-4 py-3 text-sm leading-relaxed text-white/75" aria-live="polite">
            <span className="block text-xs text-white/45">El mensaje que se va a abrir, listo para mandar:</span>“{INTERESTS[interest].message}”
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <ContactLink channel="whatsapp" interest={interest} placement={placement} className="btn btn-whatsapp">
              <IconWhatsapp />
              Escribime por WhatsApp
            </ContactLink>
            <ContactLink channel="email" interest={interest} placement={placement} className="btn btn-outline-light">
              <IconMail />
              Escribime por email
            </ContactLink>
          </div>
        </div>
      </div>
    </div>
  );
}
