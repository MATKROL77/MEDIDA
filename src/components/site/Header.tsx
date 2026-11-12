"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useDesigns } from "@/lib/designStore";

import { ContactLink } from "./ContactLink";
import { IconClose, IconHeart, IconMail, IconMenu, IconWhatsapp } from "./icons";
import { Logo } from "./Logo";

const NAV = [
  { href: "/configuradores/", label: "Configuradores" },
  { href: "/servicios/", label: "Para empresas" },
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#contacto", label: "Contacto" },
];

export function Header() {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const saved = useDesigns().designs.length;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // el menú se cierra al cambiar de página y con Escape, y no deja mover la página de atrás
  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-surface/85 backdrop-blur-md transition-colors duration-300 ${
        scrolled || menu ? "border-line" : "border-transparent"
      }`}
    >
      <div className="wrap flex h-14 items-center justify-between gap-4">
        <Link href="/" aria-label="MEDIDA, inicio" className="-ml-1 rounded-md px-1 py-1">
          <Logo />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-7 text-sm text-ink-2 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-ink" aria-current={pathname === item.href ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/mis-disenos/"
            className="relative grid size-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-paper hover:text-ink"
            aria-label={saved ? `Mis diseños: ${saved} guardados` : "Mis diseños"}
            title="Mis diseños"
          >
            <IconHeart />
            {saved > 0 && (
              <span className="absolute right-0.5 top-0.5 grid min-w-[1.1rem] place-items-center rounded-full bg-ink px-1 text-[0.62rem] font-semibold leading-[1.1rem] text-surface">
                {saved}
              </span>
            )}
          </Link>
          <ContactLink channel="whatsapp" interest="general" placement="header" className="btn btn-primary btn-sm hidden sm:inline-flex">
            <IconWhatsapp width={15} height={15} />
            Hablemos
          </ContactLink>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-paper hover:text-ink md:hidden"
            aria-expanded={menu}
            aria-controls="menu-principal"
            aria-label={menu ? "Cerrar el menú" : "Abrir el menú"}
            onClick={() => setMenu((m) => !m)}
          >
            {menu ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      {menu && (
        <div id="menu-principal" className="fade-in absolute inset-x-0 top-full h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-line bg-surface md:hidden">
          <nav aria-label="Principal" className="wrap flex flex-col py-4">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMenu(false)} className="border-b border-line py-4 font-display text-2xl font-semibold tracking-tight">
                {item.label}
              </Link>
            ))}
            <Link href="/mis-disenos/" onClick={() => setMenu(false)} className="border-b border-line py-4 font-display text-2xl font-semibold tracking-tight">
              Mis diseños{saved > 0 && <span className="ml-2 text-base font-normal text-ink-2">{saved}</span>}
            </Link>
            <div className="mt-6 grid gap-2.5">
              <ContactLink channel="whatsapp" interest="general" placement="menu" className="btn btn-whatsapp">
                <IconWhatsapp />
                Escribime por WhatsApp
              </ContactLink>
              <ContactLink channel="email" interest="general" placement="menu" className="btn btn-secondary">
                <IconMail />
                Escribime por email
              </ContactLink>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
