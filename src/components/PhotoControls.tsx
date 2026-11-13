"use client";

import { useCallback, useEffect, useState } from "react";

import { IconCamera } from "@/components/icons";
import type { PhotoStatus } from "@/components/viewer/PhotoMode";

const KEY = "medida:foto";

/**
 * Si el modo foto arranca prendido: en una computadora sí; en un teléfono
 * arranca apagado (gasta batería) y se prende a mano. Lo que elija la persona
 * se recuerda.
 */
export function usePhotoMode() {
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState<PhotoStatus>({ state: "off", progress: 0 });
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      stored = null;
    }
    const desktop = window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 900;
    setOn(stored ? stored === "1" : desktop);
  }, []);
  const toggle = useCallback(() => {
    setOn((v) => {
      try {
        localStorage.setItem(KEY, v ? "0" : "1");
      } catch {
        // sin almacenamiento, vale para esta visita
      }
      return !v;
    });
  }, []);
  return { on, toggle, status, onStatus: setStatus };
}

export function PhotoToggle({ on, toggle }: { on: boolean; toggle: () => void }) {
  return (
    <button type="button" className="tool" aria-pressed={on} onClick={toggle} title={on ? "Apagar la foto realista" : "Foto realista: luz calculada con trazado de rayos"}>
      <IconCamera />
      <span className="hidden sm:inline">Foto</span>
    </button>
  );
}

/** cuánto le falta a la foto: aparece solo mientras se calcula o cuando terminó */
export function PhotoBadge({ status }: { status: PhotoStatus }) {
  if (status.state !== "rendering" && status.state !== "done") return null;
  const pct = Math.round(status.progress * 100);
  return (
    <div className="photo-badge" role="status" aria-live="polite">
      <span>{status.state === "done" ? "Foto realista" : `Calculando la luz · ${pct}%`}</span>
      <span className="photo-badge-bar" style={{ transform: `scaleX(${status.state === "done" ? 1 : status.progress})` }} />
    </div>
  );
}
