"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { IconClose } from "./icons";

/**
 * Diálogo del sitio: hoja que sube desde abajo en el teléfono y ventana
 * centrada en pantalla grande. Se cierra con Escape o tocando afuera, atrapa
 * el foco mientras está abierto y lo devuelve al botón que lo abrió.
 */
export function Sheet({ title, eyebrow, onClose, children, wide = false }: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const focusable = () =>
      Array.from(node?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])') ?? []);
    node?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Cerrar" tabIndex={-1} className="sheet-backdrop absolute inset-0 bg-ink/45" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className={`sheet-panel relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-surface p-5 shadow-2xl outline-none sm:rounded-[1.75rem] sm:p-7 ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        }`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-4">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 className={`font-display text-xl font-semibold tracking-tight sm:text-2xl ${eyebrow ? "mt-1.5" : ""}`}>{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-paper hover:text-ink" aria-label="Cerrar">
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
