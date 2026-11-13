"use client";

import { useEffect, useRef, useState } from "react";

import { IconBulb, IconGrid, IconLayers, IconPalette, IconRuler } from "@/components/site/icons";

const ITEMS = [
  {
    id: "dimensiones",
    title: "Dimensiones",
    body: "Ancho, alto y profundidad al centímetro. El mueble se estira en pantalla y nunca pasa lo que se puede fabricar.",
    alt: "El mismo placard llevado a 3,4 metros de ancho, con cuatro módulos",
    Icon: IconRuler,
  },
  {
    id: "materiales",
    title: "Materiales",
    body: "Frentes lisos, ranurados, con espejo o de vidrio con perfil de aluminio. Cada uno se ve como es.",
    alt: "Placard con frentes ranurados en nogal, sin tiradores",
    Icon: IconLayers,
  },
  {
    id: "colores",
    title: "Colores",
    body: "Las terminaciones del catálogo para el cuerpo y para los frentes, con su veta y su tono.",
    alt: "Placard con cuerpo gris grafito y frentes verde salvia",
    Icon: IconPalette,
  },
  {
    id: "modulos",
    title: "Módulos",
    body: "Estantes, barrales y cajones: cada módulo se arma por separado y el interior se ve sin abrir las puertas.",
    alt: "Placard abierto que muestra estantes, barrales y cajones en cada módulo",
    Icon: IconGrid,
  },
  {
    id: "iluminacion",
    title: "Iluminación",
    body: "Tiras LED bajo los estantes y en los laterales, en luz cálida, neutra, fría o de color. Se prenden en la escena.",
    alt: "Placard abierto con las luces LED cálidas prendidas",
    Icon: IconBulb,
  },
] as const;

const INTERVAL = 5200;

/**
 * Lo que el cliente puede cambiar, con una imagen real del configurador para
 * cada cosa. Avanza solo mientras está en pantalla y se detiene en cuanto la
 * persona elige una.
 */
export function Highlights() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [inView, setInView] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || !inView || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % ITEMS.length), INTERVAL);
    return () => window.clearInterval(id);
  }, [auto, inView]);

  const pick = (i: number) => {
    setAuto(false);
    setActive(i);
  };

  return (
    <div ref={root} className="grid items-center gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
      <div className="order-2 min-w-0 lg:order-1">
        <div role="tablist" aria-label="Qué se puede cambiar" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0">
          {ITEMS.map((item, i) => {
            const on = i === active;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`exp-tab-${item.id}`}
                aria-selected={on}
                aria-controls="exp-panel"
                onClick={() => pick(i)}
                className={`group flex shrink-0 items-center gap-3 rounded-full border px-4 py-2.5 text-left transition-colors duration-300 lg:w-full lg:items-start lg:rounded-2xl lg:border-0 lg:px-5 lg:py-4 ${
                  on ? "border-ink bg-ink text-on-dark lg:bg-paper lg:text-ink" : "border-line text-ink-2 hover:text-ink lg:hover:bg-paper/60"
                }`}
              >
                <item.Icon className={`shrink-0 lg:mt-0.5 ${on ? "lg:text-accent" : ""}`} />
                <span>
                  <span className="block text-sm font-semibold lg:font-display lg:text-xl lg:tracking-tight">{item.title}</span>
                  <span className={`hidden overflow-hidden text-[0.95rem] leading-relaxed text-ink-2 transition-[grid-template-rows,opacity] duration-500 lg:grid ${on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <span className="min-h-0">
                      <span className="block pt-1.5">{item.body}</span>
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {/* en el teléfono la descripción va debajo de las solapas */}
        <p className="mt-4 min-h-[4.5rem] text-[0.95rem] leading-relaxed text-ink-2 lg:hidden">{ITEMS[active].body}</p>
      </div>

      <div id="exp-panel" role="tabpanel" aria-labelledby={`exp-tab-${ITEMS[active].id}`} className="tile relative order-1 aspect-[4/3] min-w-0 overflow-hidden lg:order-2">
        {ITEMS.map((item, i) => (
          <img
            key={item.id}
            src={`/img/exp-${item.id}.webp`}
            alt={i === active ? item.alt : ""}
            aria-hidden={i !== active}
            width={1400}
            height={1050}
            loading="lazy"
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === active ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        {auto && inView && (
          <span key={active} className="absolute bottom-0 left-0 h-0.5 bg-ink/25 motion-reduce:hidden" style={{ animation: `progress ${INTERVAL}ms linear both` }} aria-hidden />
        )}
      </div>
    </div>
  );
}
