"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { catalog } from "@/lib/catalog";
import { hasLeds, normalize, totalHeight, type WardrobeConfig } from "@/lib/model";
import { HERO_CONFIG } from "@/lib/presets";
import { money } from "@/lib/quote";
import { encodeConfig } from "@/lib/share";

// el motor 3D se baja recién cuando hace falta: no pesa en la carga de la página
const HeroLive = dynamic(() => import("./HeroLive"), { ssr: false, loading: () => null });

const WIDTH = { min: 1600, max: 3600, step: 200 };

/** si el 3D falla (sin WebGL, sin memoria), queda la imagen fija y la página sigue */
class Fallback extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * El mueble del hero. Primero se ve una imagen ya optimizada; cuando la página
 * terminó de cargar y el bloque está en pantalla, baja el 3D y lo reemplaza
 * con un fundido. Fuera de pantalla deja de dibujar.
 */
export function HeroStage() {
  const stage = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<WardrobeConfig>(HERO_CONFIG);
  const [open, setOpen] = useState(false);
  const [lights, setLights] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  // "idle": imagen fija · "loading": bajando el 3D · "live": 3D en pantalla · "failed": se queda la imagen
  const [phase, setPhase] = useState<"idle" | "loading" | "live" | "failed">("idle");
  const [visible, setVisible] = useState(true);
  const [draggable, setDraggable] = useState(false);
  // datos ahorrados o movimiento reducido: el 3D espera a que la persona lo pida
  const [manual, setManual] = useState(false);

  const start = useCallback(() => setPhase((p) => (p === "idle" ? "loading" : p)), []);

  useEffect(() => {
    setDraggable(window.matchMedia("(pointer: fine)").matches);
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (saveData || reduced) {
      setManual(true);
      return;
    }
    // después de que la página quedó quieta, para no competir con su carga
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => start(), { timeout: 2500 });
    return () => cancel(id);
  }, [start]);

  useEffect(() => {
    const node = stage.current;
    if (!node || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const update = (patch: Partial<WardrobeConfig>) => {
    start();
    setConfig((c) => normalize({ ...c, ...patch }));
  };
  const setWidth = (width: number) =>
    // al cambiar el ancho los módulos se vuelven a repartir parejo
    update({ runs: config.runs.map((r, i) => (i === 0 ? { width, modules: r.modules.map((m) => ({ ...m, width: 0 })) } : r)) });

  const width = config.runs[0].width;
  const dims = `${Math.round(width / 10)} × ${Math.round(totalHeight(config) / 10)} × ${Math.round(config.depth / 10)} cm`;
  const live = phase === "live";

  return (
    <div>
      <div className="relative">
      <div ref={stage} className="tile relative aspect-[4/5] w-full overflow-hidden sm:aspect-[16/10] lg:aspect-[2/1] lg:max-h-[min(72vh,760px)]">
        <picture>
          <source media="(max-width: 639px)" srcSet="/img/hero-movil.webp" />
          <img
            src="/img/hero.webp"
            alt="Un placard de tres módulos con frentes de roble y cuerpo grafito, dibujado en 3D por el configurador de MEDIDA"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${live ? "opacity-0" : "opacity-100"}`}
            fetchPriority="high"
            decoding="async"
          />
        </picture>

        {(phase === "loading" || live) && (
          <div className={`absolute inset-0 transition-opacity duration-700 ${live ? "opacity-100" : "opacity-0"} ${draggable ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}>
            <Fallback onError={() => setPhase("failed")}>
              <HeroLive
                config={config}
                open={open}
                lights={lights}
                paused={!visible}
                draggable={draggable}
                onReady={() => setPhase((p) => (p === "loading" ? "live" : p))}
                onPrice={setPrice}
              />
            </Fallback>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-5">
          <p className="rounded-full bg-surface/85 px-3 py-1.5 text-xs font-medium tabular-nums text-ink shadow-sm backdrop-blur-sm">{dims}</p>
          {price !== null && (
            <p className="fade-in rounded-full bg-surface/85 px-3 py-1.5 text-right text-xs text-ink-2 shadow-sm backdrop-blur-sm">
              <span className="font-medium tabular-nums text-ink">{money(price)}</span> · precio de muestra
            </p>
          )}
        </div>

        {manual && phase === "idle" && (
          <button type="button" onClick={start} className="btn btn-primary btn-sm absolute bottom-5 left-1/2 -translate-x-1/2 shadow-lg sm:bottom-24">
            Ver en 3D
          </button>
        )}
        {draggable && live && (
          <p className="pointer-events-none absolute bottom-20 left-1/2 hidden -translate-x-1/2 text-xs text-ink-3 lg:block" aria-hidden>
            Arrastrá para girarlo
          </p>
        )}
      </div>

      {/* controles: sobre el bloque en pantalla grande, debajo en el teléfono */}
      <div className="mt-3 flex justify-center sm:absolute sm:inset-x-0 sm:bottom-5 sm:mt-0">
        <div className="dock" role="group" aria-label="Probá el configurador">
          <div className="flex items-center gap-1.5 px-1.5" role="group" aria-label="Color de los frentes">
            {catalog.materials.map((m) => (
              <button
                key={m.id}
                type="button"
                title={m.name}
                aria-label={`Frentes: ${m.name}`}
                aria-pressed={config.doorMaterial === m.id}
                onClick={() => update({ doorMaterial: m.id })}
                className={`swatch size-7 rounded-full border-2 ${config.doorMaterial === m.id ? "border-ink" : "border-surface ring-1 ring-line"}`}
                style={{
                  background: m.grain
                    ? `repeating-linear-gradient(100deg, ${m.color} 0 5px, color-mix(in srgb, ${m.color} 86%, black) 5px 6px, ${m.color} 6px 11px)`
                    : m.color,
                }}
              />
            ))}
          </div>
          <span className="tool-sep hidden sm:block" />
          <div className="flex items-center gap-1 px-1 text-sm" role="group" aria-label="Ancho">
            <button type="button" className="tool px-2.5" disabled={width <= WIDTH.min} onClick={() => setWidth(Math.max(WIDTH.min, width - WIDTH.step))} aria-label="Más angosto">
              −
            </button>
            <span className="w-[4.4rem] text-center text-[0.8rem] tabular-nums text-ink-2">
              Ancho <span className="font-medium text-ink">{Math.round(width / 10)}</span>
            </span>
            <button type="button" className="tool px-2.5" disabled={width >= WIDTH.max} onClick={() => setWidth(Math.min(WIDTH.max, width + WIDTH.step))} aria-label="Más ancho">
              +
            </button>
          </div>
          <span className="tool-sep hidden sm:block" />
          <button
            type="button"
            className="tool"
            aria-pressed={open}
            onClick={() => {
              start();
              setOpen((o) => !o);
            }}
          >
            {open ? "Cerrar" : "Abrir"}
          </button>
          {hasLeds(config) && (
            <button
              type="button"
              className="tool"
              aria-pressed={lights}
              onClick={() => {
                start();
                setLights((l) => !l);
              }}
            >
              Luces
            </button>
          )}
        </div>
      </div>

      </div>

      <p className="mt-4 text-center text-sm text-ink-2 sm:mt-5">
        Esto es el configurador de verdad, funcionando.{" "}
        <Link href={`/demo/?c=${encodeConfig(config)}`} className="link-arrow">
          Seguí con este diseño
        </Link>
      </p>
    </div>
  );
}
