"use client";

import { useEffect } from "react";

/**
 * Mientras la persona mira la portada, el navegador baja en segundo plano el
 * motor 3D y la foto del estudio: al abrir un configurador ya están y el
 * mueble aparece enseguida. No se hace con ahorro de datos.
 */
export function Warmup() {
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const start = () => {
      import("@/components/viewer/Scene").catch(() => {});
      fetch("/env/studio_small_09-1k.hdr", { priority: "low" } as RequestInit).catch(() => {});
    };
    // Safari no tiene requestIdleCallback: un rato después de cargar
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const timer = window.setTimeout(() => (idle ? idle(start, { timeout: 4000 }) : start()), 1500);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
