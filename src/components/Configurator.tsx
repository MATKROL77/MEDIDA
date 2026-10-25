"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LayoutIcon } from "@/components/LayoutIcon";
import { catalog, type HandleType } from "@/lib/catalog";
import {
  DEFAULT_CONFIG,
  LAYOUT_LABELS,
  LIMITS,
  innerModuleWidth,
  interiorHeight,
  layoutFits,
  normalize,
  validModuleCounts,
  type DoorType,
  type Layout,
  type ModuleConfig,
  type WardrobeConfig,
} from "@/lib/model";
import { money, quote } from "@/lib/quote";
import { decodeConfig, encodeConfig, orderMessage, whatsappLink } from "@/lib/share";

// el 3D sólo existe en el navegador; en el HTML estático va un lugar reservado
const Viewer3D = dynamic(() => import("@/components/Viewer3D"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-ink-2">Cargando el 3D…</div>,
});

const LAYOUTS = Object.keys(LAYOUT_LABELS) as Layout[];
const DOORS: { id: DoorType; label: string }[] = [
  { id: "none", label: "Sin puertas" },
  { id: "hinged", label: "Batientes" },
  { id: "sliding", label: "Corredizas" },
];
const HANDLES: { id: HandleType; label: string }[] = [
  { id: "bar", label: "Barral" },
  { id: "knob", label: "Botón" },
  { id: "none", label: "Sin tirador" },
];

function shareLink(config: WardrobeConfig, path = "/demo/") {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${path}?c=${encodeConfig(config)}`;
}

export default function Configurator() {
  const [config, setConfig] = useState<WardrobeConfig>(DEFAULT_CONFIG);
  const [selected, setSelected] = useState(0);
  const [doorsOpen, setDoorsOpen] = useState(false);

  // un link compartido abre el placard que armó el cliente
  useEffect(() => {
    const fromUrl = decodeConfig(new URLSearchParams(window.location.search).get("c"));
    if (fromUrl) setConfig(fromUrl);
  }, []);

  // el link de la barra siempre reproduce lo que se ve, por si lo copian
  useEffect(() => {
    const id = setTimeout(() => {
      window.history.replaceState(null, "", `?c=${encodeConfig(config)}`);
    }, 300);
    return () => clearTimeout(id);
  }, [config]);

  const result = useMemo(() => quote(config), [config]);
  const update = (patch: Partial<WardrobeConfig>) => setConfig((c) => normalize({ ...c, ...patch }));
  const updateModule = (i: number, patch: Partial<ModuleConfig>) =>
    setConfig((c) => normalize({ ...c, modules: c.modules.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));

  const counts = validModuleCounts(config.width);
  const moduleIndex = Math.min(selected, config.modules.length - 1);
  const mod = config.modules[moduleIndex];
  const interior = interiorHeight(config);
  const hasHandles = config.doors !== "none" || config.modules.some((m) => m.drawers > 0);

  const setModuleCount = (n: number) => {
    const modules = Array.from({ length: n }, (_, i) => config.modules[i] ?? config.modules[config.modules.length - 1]);
    update({ modules });
    setSelected((s) => Math.min(s, n - 1));
  };

  const priceLabel = money(result.price);
  const orderHref = whatsappLink(orderMessage(config, priceLabel, shareLink(config)));

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_420px]">
      {/* visor: arriba en el teléfono, a la izquierda en pantalla grande */}
      <section className="relative h-[46dvh] min-h-[320px] lg:h-full">
        <Viewer3D
          config={config}
          parts={result.assembly.parts}
          doorsOpen={doorsOpen}
          selectedModule={moduleIndex}
          onSelectModule={setSelected}
        />
        <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          <div className="pointer-events-auto rounded-2xl bg-surface/90 px-4 py-2.5 shadow-sm backdrop-blur">
            <p className="font-display text-base font-semibold leading-tight">{catalog.brand.name}</p>
            <p className="text-xs text-ink-2">{catalog.brand.tagline}</p>
          </div>
          {config.doors !== "none" && (
            <button
              type="button"
              onClick={() => setDoorsOpen((o) => !o)}
              className="btn btn-ghost pointer-events-auto px-4 py-2 text-sm shadow-sm"
            >
              {doorsOpen ? "Cerrar puertas" : "Abrir puertas"}
            </button>
          )}
        </header>
        <div className="pointer-events-none absolute inset-x-4 bottom-3 flex items-end justify-between gap-3">
          <p className="text-xs text-ink-2">Arrastrá para girar · tocá un módulo para editarlo</p>
          <p className="shrink-0 rounded-full bg-surface/90 px-3 py-1 text-xs font-semibold tabular-nums shadow-sm">
            {Math.round(config.width / 10)} × {Math.round(config.height / 10)} × {Math.round(config.depth / 10)} cm
          </p>
        </div>
      </section>

      <aside className="flex flex-col border-line bg-surface lg:min-h-0 lg:border-l">
        <div className="flex-1 space-y-7 overflow-y-auto px-5 pb-32 pt-6 lg:pb-6">
          {catalog.brand.demo && (
            <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs leading-relaxed text-accent-strong">
              Demo: la marca y los precios son de ejemplo. Cada taller carga los suyos.
            </p>
          )}

          <Section title="Medidas">
            <Dimension label="Ancho" value={config.width} limits={LIMITS.width} onChange={(width) => update({ width })} />
            <Dimension label="Alto" value={config.height} limits={LIMITS.height} onChange={(height) => update({ height })} />
            <Dimension
              label="Profundidad"
              value={config.depth}
              limits={LIMITS.depth}
              onChange={(depth) => update({ depth })}
            />
            <label className="flex items-center justify-between text-sm">
              <span>Zócalo de 8 cm</span>
              <input
                type="checkbox"
                checked={config.plinth}
                onChange={(e) => update({ plinth: e.target.checked })}
                className="size-4 accent-[var(--color-accent)]"
              />
            </label>
          </Section>

          <Section title="Módulos" hint={`${Math.round(innerModuleWidth(config.width, config.modules.length) / 10)} cm cada uno por dentro`}>
            <div className="segment">
              {counts.map((n) => (
                <button key={n} type="button" aria-pressed={n === config.modules.length} onClick={() => setModuleCount(n)}>
                  {n}
                </button>
              ))}
            </div>
          </Section>

          <Section title={`Interior del módulo ${moduleIndex + 1}`}>
            <div className="segment">
              {config.modules.map((_, i) => (
                <button key={i} type="button" aria-pressed={i === moduleIndex} onClick={() => setSelected(i)}>
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {LAYOUTS.map((layout) => {
                const fits = layoutFits(layout, interior, Math.max(1, mod.drawers));
                const active = mod.layout === layout;
                return (
                  <button
                    key={layout}
                    type="button"
                    disabled={!fits}
                    aria-pressed={active}
                    title={fits ? LAYOUT_LABELS[layout] : "No entra con este alto"}
                    onClick={() =>
                      updateModule(moduleIndex, {
                        layout,
                        drawers: layout.startsWith("drawers") ? Math.max(2, mod.drawers) : 0,
                        shelves: layout === "shelves" || layout === "drawers-shelves" ? Math.max(2, mod.shelves) : mod.shelves,
                      })
                    }
                    className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] leading-tight transition-colors disabled:opacity-30 ${
                      active ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-ink-2 hover:border-ink-2"
                    }`}
                  >
                    <LayoutIcon layout={layout} />
                    {LAYOUT_LABELS[layout]}
                  </button>
                );
              })}
            </div>
            {(mod.layout === "shelves" || mod.layout === "drawers-shelves") && (
              <Stepper
                label="Estantes"
                value={mod.shelves}
                min={mod.layout === "shelves" ? 1 : 0}
                max={LIMITS.shelves.max}
                onChange={(shelves) => updateModule(moduleIndex, { shelves })}
              />
            )}
            {mod.drawers > 0 && (
              <Stepper
                label="Cajones"
                value={mod.drawers}
                min={1}
                max={LIMITS.drawers.max}
                onChange={(drawers) => updateModule(moduleIndex, { drawers })}
              />
            )}
          </Section>

          <Section title="Puertas">
            <div className="segment">
              {DOORS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={config.doors === d.id}
                  onClick={() => {
                    update({ doors: d.id });
                    setDoorsOpen(false);
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {hasHandles && (
              <div className="segment">
                {HANDLES.map((h) => (
                  <button key={h.id} type="button" aria-pressed={config.handle === h.id} onClick={() => update({ handle: h.id })}>
                    {h.label}
                  </button>
                ))}
              </div>
            )}
          </Section>

          <Section title="Terminaciones">
            <Swatches label="Cuerpo" value={config.bodyMaterial} onChange={(bodyMaterial) => update({ bodyMaterial })} />
            <Swatches
              label={config.doors === "none" ? "Frentes de cajón" : "Puertas"}
              value={config.doorMaterial}
              onChange={(doorMaterial) => update({ doorMaterial })}
            />
          </Section>

          <Link href={`/demo/taller/?c=${encodeConfig(config)}`} className="block text-sm font-medium text-accent underline-offset-4 hover:underline">
            Ver lo que le llega al taller →
          </Link>
        </div>

        {/* precio y pedido: fijos abajo en el teléfono, al pie del panel en pantalla grande */}
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 px-5 py-4 backdrop-blur lg:static">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-ink-2">Precio estimado</p>
              <p className="font-display text-2xl font-semibold tabular-nums">{priceLabel}</p>
            </div>
            <a href={orderHref} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp shrink-0 text-sm">
              Pedir por WhatsApp
            </a>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-2">
            Incluye materiales y fabricación. El precio final se confirma al medir en tu casa.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="eyebrow">{title}</h2>
        {hint && <span className="text-xs text-ink-2">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Dimension({ label, value, limits, onChange }: {
  label: string;
  value: number;
  limits: { min: number; max: number };
  onChange: (mm: number) => void;
}) {
  const cm = Math.round(value / 10);
  const [draft, setDraft] = useState(String(cm));
  useEffect(() => setDraft(String(cm)), [cm]);

  // el número se aplica al salir del campo: mientras se tipea "2" no tiene que
  // saltar al mínimo
  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n > 0) onChange(n * 10);
    else setDraft(String(cm));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={`dim-${label}`}>{label}</label>
        <span className="flex items-center gap-1">
          <input
            id={`dim-${label}`}
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className="w-16 rounded-lg border border-line bg-paper px-2 py-1 text-right tabular-nums focus:border-accent focus:outline-none"
          />
          <span className="text-ink-2">cm</span>
        </span>
      </div>
      <input
        type="range"
        aria-label={`${label} en centímetros`}
        min={limits.min / 10}
        max={limits.max / 10}
        value={cm}
        onChange={(e) => onChange(Number(e.target.value) * 10)}
        className="w-full"
      />
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const btn = "grid size-8 place-items-center rounded-full border border-line text-lg leading-none disabled:opacity-30";
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-3">
        <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Menos ${label.toLowerCase()}`}>
          −
        </button>
        <span className="w-4 text-center tabular-nums">{value}</span>
        <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`Más ${label.toLowerCase()}`}>
          +
        </button>
      </span>
    </div>
  );
}

function Swatches({ label, value, onChange }: { label: string; value: string; onChange: (id: string) => void }) {
  const current = catalog.materials.find((m) => m.id === value);
  return (
    <div className="space-y-2">
      <p className="text-sm">
        {label}: <span className="text-ink-2">{current?.name}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {catalog.materials.map((m) => (
          <button
            key={m.id}
            type="button"
            title={m.name}
            aria-label={m.name}
            aria-pressed={m.id === value}
            onClick={() => onChange(m.id)}
            className={`size-9 rounded-full border-2 transition-transform ${
              m.id === value ? "scale-110 border-ink" : "border-surface ring-1 ring-line"
            }`}
            style={{
              background: m.grain
                ? `repeating-linear-gradient(90deg, ${m.color} 0 5px, color-mix(in srgb, ${m.color} 85%, black) 5px 6px)`
                : m.color,
            }}
          />
        ))}
      </div>
    </div>
  );
}
