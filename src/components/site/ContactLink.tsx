"use client";

import type { ReactNode } from "react";

import { contactLink, type ContactChannel, type Interest } from "@/lib/site";
import { trackIntent } from "@/lib/track";

import { useSite } from "./SiteProvider";

/**
 * Todo botón de contacto comercial con MEDIDA pasa por acá: arma el enlace
 * con el número y el email vigentes y el mensaje del servicio que interesa.
 */
export function ContactLink({ channel, interest = "general", message, placement, className, children, label }: {
  channel: ContactChannel;
  interest?: Interest;
  /** reemplaza el mensaje del interés, por ejemplo para nombrar una familia de producto */
  message?: string;
  /** desde dónde se toca, para saber qué parte del sitio genera contactos */
  placement: string;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  const { contact } = useSite();
  return (
    <a
      href={contactLink(contact, channel, interest, message)}
      {...(channel === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      aria-label={label}
      className={className}
      onClick={() => trackIntent({ type: channel === "whatsapp" ? "whatsapp_click" : "email_start", interest, placement })}
    >
      {children}
    </a>
  );
}
