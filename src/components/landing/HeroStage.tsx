"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { PhotoBadge, PhotoToggle, usePhotoMode } from "@/components/PhotoControls";
import { toBase64Url } from "@/lib/base64url";
import { buildFurniture, FABRICS, fabricById, normalizeFurniture, type FurnitureConfig } from "@/lib/furniture";
import { HERO_SOFA } from "@/lib/presets";
import { money } from "@/lib/quote";
import { fabricStyle } from "@/lib/swatch";

// el motor 3D se baja recién cuando hace falta: no pesa en la carga de la página
const HeroLive = dynamic(() => import("./HeroLive"), { ssr: false, loading: () => null });

const MODELS = [
  ["recto", "Recto"],
  ["burbujas", "Burbujas"],
  ["curvo", "Curvo"],
] as const;
const SEATS = { min: 1, max: 5 };

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
 * La portada: el sillón curvo, calculado con trazado de rayos, con lo que se
 * puede cambiar encima. Primero se ve una foto ya calculada (la misma escena);
 * cuando la página terminó de cargar y el bloque está en pantalla, baja el 3D
 * y la reemplaza con un fundido. Fuera de pantalla deja de dibujar.
 */
export function HeroStage() {
  const stage = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<FurnitureConfig>(HERO_SOFA);
  const [price, setPrice] = useState<number | null>(null);
  // "idle": imagen fija · "loading": bajando el 3D · "live": 3D en pantalla · "failed": se queda la imagen
  const [phase, setPhase] = useState<"idle" | "loading" | "live" | "failed">("idle");
  const [visible, setVisible] = useState(true);
  const [draggable, setDraggable] = useState(false);
  // datos ahorrados o movimiento reducido: el 3D espera a que la persona lo pida
  const [manual, setManual] = useState(false);
  const photo = usePhotoMode();
  // con un configurador abierto en ventana encima, la portada no gasta placa de video
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setCovered((e as CustomEvent<boolean>).detail);
    window.addEventListener("medida:ventana", on);
    return () => window.removeEventListener("medida:ventana", on);
  }, []);

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

  const set = (key: string, value: string | number) => {
    start();
    setConfig((c) => normalizeFurniture({ ...c, values: { ...c.values, [key]: value } }));
  };
  const setFabric = (fabric: string) => {
    start();
    setConfig((c) => ({ ...c, fabric }));
  };

  const { min, max } = useMemo(() => buildFurniture(config).assembly.bounds, [config]);
  const dims = `${Math.round((max[0] - min[0]) / 10)} × ${Math.round((max[2] - min[2]) / 10)} × ${Math.round(max[1] / 10)} cm`;
  const seats = config.values.seats as number;
  const fabric = fabricById(config.fabric);
  const model = MODELS.find(([id]) => id === config.values.style)?.[1] ?? "";
  const live = phase === "live";

  return (
    <div>
      <div className="relative">
        <div ref={stage} className="hero-stage relative aspect-[4/5] w-full overflow-hidden sm:aspect-[16/10] lg:aspect-[2/1] lg:max-h-[min(78vh,820px)]">
          <picture>
            <source media="(max-width: 639px)" srcSet="/img/hero-movil.webp" />
            <img
              src="/img/hero.webp"
              alt="Un sillón curvo de bouclé crudo con su puff, calculado con trazado de rayos por el configurador de MEDIDA"
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
                  paused={!visible || covered}
                  draggable={draggable}
                  photo={photo.on}
                  onReady={() => setPhase((p) => (p === "loading" ? "live" : p))}
                  onPrice={setPrice}
                  onPhoto={photo.onStatus}
                />
              </Fallback>
            </div>
          )}

          {/* la ficha del mueble, como en un catálogo */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
            <div className="hero-chip">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-ink-2">Sillón {model.toLowerCase()}</p>
              <p className="mt-0.5 font-display text-base leading-tight sm:text-lg">{fabric.name}</p>
              <p className="mt-0.5 text-xs tabular-nums text-ink-2">{dims}</p>
            </div>
            {price !== null && (
              <p className="hero-chip fade-in text-right text-xs text-ink-2">
                <span className="block font-display text-base tabular-nums text-ink sm:text-lg">{money(price)}</span>
                precio de muestra
              </p>
            )}
          </div>

          {live && <PhotoBadge status={photo.status} />}

          {manual && phase === "idle" && (
            <button type="button" onClick={start} className="btn btn-primary btn-sm absolute bottom-5 left-1/2 -translate-x-1/2 shadow-lg sm:bottom-24">
              Ver en 3D
            </button>
          )}
          {draggable && live && (
            <p className="pointer-events-none absolute bottom-20 left-1/2 hidden -translate-x-1/2 text-xs text-ink-2 lg:block" aria-hidden>
              Arrastrá para girarlo
            </p>
          )}
        </div>

        {/* lo que se puede cambiar: sobre el bloque en pantalla grande, debajo en el teléfono */}
        <div className="mt-3 flex justify-center sm:absolute sm:inset-x-0 sm:bottom-5 sm:mt-0 sm:px-4">
          <div className="dock" role="group" aria-label="Probá el configurador">
            <div className="flex items-center gap-0.5" role="group" aria-label="Modelo">
              {MODELS.map(([id, label]) => (
                <button key={id} type="button" className="tool px-2.5" aria-pressed={config.values.style === id} onClick={() => set("style", id)}>
                  {label}
                </button>
              ))}
            </div>
            <span className="tool-sep hidden sm:block" />
            <div className="flex flex-wrap items-center justify-center gap-1.5 px-1.5" role="group" aria-label="Tapizado">
              {FABRICS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  title={f.name}
                  aria-label={`Tapizado: ${f.name}`}
                  aria-pressed={config.fabric === f.id}
                  onClick={() => setFabric(f.id)}
                  className={`swatch size-7 rounded-full border-2 ${config.fabric === f.id ? "border-wood" : "border-white/70"}`}
                  style={fabricStyle(f)}
                />
              ))}
            </div>
            <span className="tool-sep hidden sm:block" />
            <div className="flex items-center gap-1 px-1 text-sm" role="group" aria-label="Cuerpos">
              <button type="button" className="tool px-2.5" disabled={seats <= SEATS.min} onClick={() => set("seats", seats - 1)} aria-label="Un cuerpo menos">
                −
              </button>
              <span className="w-[4.6rem] text-center text-[0.8rem] tabular-nums text-ink-2">
                <span className="font-medium text-ink">{seats}</span> {seats === 1 ? "cuerpo" : "cuerpos"}
              </span>
              <button type="button" className="tool px-2.5" disabled={seats >= SEATS.max} onClick={() => set("seats", seats + 1)} aria-label="Un cuerpo más">
                +
              </button>
            </div>
            <span className="tool-sep hidden sm:block" />
            <PhotoToggle on={photo.on} toggle={photo.toggle} />
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-ink-2 sm:mt-5">
        Esto es el configurador de verdad, funcionando.{" "}
        <Link href={`/demo/sillones/?c=${toBase64Url(JSON.stringify(config))}`} className="link-arrow">
          Seguí con este diseño
        </Link>
      </p>
    </div>
  );
}
