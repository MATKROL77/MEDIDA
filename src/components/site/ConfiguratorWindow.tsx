"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { familyById, FAMILIES } from "@/lib/families";

import { IconClose } from "./icons";

/** un enlace a un configurador: /demo/ o /demo/<familia>/, no la vista del taller */
function configuratorHref(anchor: HTMLAnchorElement): string | null {
  if (anchor.origin !== window.location.origin || anchor.target === "_blank") return null;
  return FAMILIES.some((f) => f.href === anchor.pathname) ? anchor.pathname + anchor.search : null;
}

/**
 * Los configuradores se abren como una ventana sobre la página: la página
 * queda atrás, fuera de foco, y al cerrar se vuelve a donde se estaba. El
 * enlace directo (/demo/…) sigue abriendo el configurador a pantalla completa.
 *
 * Además, cuando esta misma página está adentro de esa ventana, los enlaces
 * que salen del configurador navegan la página de atrás.
 */
export function ConfiguratorWindow() {
  const pathname = usePathname() ?? "/";
  const [href, setHref] = useState<string | null>(null);
  // dentro de la ventana se puede pasar a otro configurador: el título lo acompaña
  const [inside, setInside] = useState<string | null>(null);

  useEffect(() => {
    const framed = window.self !== window.top;
    if (framed) window.parent.postMessage({ medida: "configurador", path: window.location.pathname }, window.location.origin);
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.medida === "configurador" && typeof e.data.path === "string") setInside(e.data.path);
    };
    window.addEventListener("message", onMessage);
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const target = configuratorHref(anchor);
      if (framed) {
        // adentro de la ventana: lo que no es un configurador se abre en la página de atrás
        if (!target && anchor.origin === window.location.origin && !anchor.pathname.startsWith("/demo/taller")) {
          e.preventDefault();
          window.top!.location.assign(anchor.href);
        }
        return;
      }
      // desde un configurador a pantalla completa se navega normal
      if (!target || window.location.pathname.startsWith("/demo")) return;
      e.preventDefault();
      setHref(target);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  useEffect(() => setHref(null), [pathname]);
  useEffect(() => {
    if (!href) setInside(null);
  }, [href]);

  useEffect(() => {
    if (!href) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setHref(null);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [href]);

  if (!href) return null;
  const family = FAMILIES.find((f) => f.href === inside) ?? FAMILIES.find((f) => f.href === href.split("?")[0]) ?? familyById("placares")!;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={`Configurador de ${family.name.toLowerCase()}`}>
      <button type="button" aria-label="Cerrar el configurador" tabIndex={-1} className="sheet-backdrop veil absolute inset-0" onClick={() => setHref(null)} />
      <div className="window-in glass absolute inset-x-2 bottom-2 top-3 flex flex-col overflow-hidden rounded-[1.9rem] p-1.5 sm:inset-x-[3vw] sm:bottom-[3vh] sm:top-[3vh] lg:inset-x-[5vw]">
        <div className="flex items-center justify-between gap-3 px-3 py-1.5">
          <p className="truncate font-display text-lg">{family.name}</p>
          <div className="flex items-center gap-1">
            <a href={href} target="_blank" rel="noopener noreferrer" className="hidden rounded-full px-3 py-1.5 text-xs text-ink-2 hover:bg-surface/70 hover:text-ink sm:block">
              Abrir en pantalla completa
            </a>
            <button type="button" onClick={() => setHref(null)} className="grid size-9 place-items-center rounded-full bg-surface/70 text-ink hover:bg-surface" aria-label="Cerrar" autoFocus>
              <IconClose width={18} height={18} />
            </button>
          </div>
        </div>
        <iframe src={href} title={`Configurador de ${family.name.toLowerCase()}`} className="min-h-0 w-full flex-1 rounded-[1.5rem] bg-surface" allow="clipboard-write; web-share" />
      </div>
    </div>
  );
}
