"use client";

import Link from "next/link";

import { openCookiePreferences } from "@/lib/consent";
import { FAMILIES } from "@/lib/families";
import { SERVICES } from "@/lib/services";
import { formatWhatsapp, site } from "@/lib/site";

import { ContactLink } from "./ContactLink";
import { Logo } from "./Logo";
import { useSite } from "./SiteProvider";

export function Footer() {
  const { contact } = useSite();
  const demos = FAMILIES.filter((f) => f.status === "demo");
  return (
    <footer className="border-t border-line bg-paper">
      <div className="wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-2">{site.tagline}. Tus clientes configuran el producto y te llega la consulta completa.</p>
        </div>

        <nav aria-label="Producto" className="text-sm">
          <h2 className="font-semibold">Producto</h2>
          <ul className="mt-4 space-y-2.5 text-ink-2">
            <li>
              <Link href="/configuradores/" className="hover:text-ink">
                Configuradores
              </Link>
            </li>
            {demos.map((f) => (
              <li key={f.id}>
                <Link href={f.href!} className="hover:text-ink">
                  Demo de {f.name.toLowerCase()}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/mis-disenos/" className="hover:text-ink">
                Mis diseños
              </Link>
            </li>
            <li>
              <Link href="/cuenta/" className="hover:text-ink">
                Mi cuenta
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Para empresas" className="text-sm">
          <h2 className="font-semibold">Para empresas</h2>
          <ul className="mt-4 space-y-2.5 text-ink-2">
            {SERVICES.map((s) => (
              <li key={s.slug}>
                <Link href={`/servicios/${s.slug}/`} className="hover:text-ink">
                  {s.title}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/panel/" className="hover:text-ink">
                Panel de empresa
              </Link>
            </li>
          </ul>
        </nav>

        <div className="text-sm">
          <h2 className="font-semibold">Contacto</h2>
          <ul className="mt-4 space-y-2.5 text-ink-2">
            <li>
              <ContactLink channel="whatsapp" interest="general" placement="footer" className="hover:text-ink">
                WhatsApp {formatWhatsapp(contact.whatsapp)}
              </ContactLink>
            </li>
            <li>
              <ContactLink channel="email" interest="general" placement="footer" className="break-all hover:text-ink">
                {contact.email}
              </ContactLink>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="wrap flex flex-col gap-3 py-6 text-xs text-ink-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {site.name} · hecho por {site.maker} en {site.makerCity}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link href="/privacidad/" className="hover:text-ink">
                Privacidad
              </Link>
            </li>
            <li>
              <Link href="/cookies/" className="hover:text-ink">
                Cookies
              </Link>
            </li>
            <li>
              <Link href="/terminos/" className="hover:text-ink">
                Términos
              </Link>
            </li>
            <li>
              <button type="button" onClick={openCookiePreferences} className="hover:text-ink">
                Preferencias de cookies
              </button>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
