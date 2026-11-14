"use client";

import { useCallback, useState } from "react";

import { IconCamera } from "@/components/icons";
import type { PhotoStatus } from "@/components/viewer/PhotoMode";

/**
 * El modo realista arranca apagado siempre y se calcula solo cuando la persona
 * aprieta "Realismo": el trazado de rayos usa la placa de video del equipo y
 * no tiene que cargarlo sin que nadie lo pida. Mientras está prendido, cada
 * vez que la escena se queda quieta se vuelve a calcular.
 */
export function usePhotoMode() {
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState<PhotoStatus>({ state: "off", progress: 0 });
  const toggle = useCallback(() => setOn((v) => !v), []);
  return { on, toggle, status, onStatus: setStatus };
}

export function PhotoToggle({ on, toggle }: { on: boolean; toggle: () => void }) {
  return (
    <button type="button" className="tool" aria-pressed={on} onClick={toggle} aria-label="Realismo" title={on ? "Volver al 3D rápido" : "Realismo: la luz calculada con trazado de rayos"}>
      <IconCamera />
      <span className="hidden sm:inline">Realismo</span>
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
