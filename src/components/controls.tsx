"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { catalog } from "@/lib/catalog";

export function Section({ title, hint, children, phoneTitle = true }: { title: string; hint?: ReactNode; children: ReactNode; phoneTitle?: boolean }) {
  return (
    <section className="space-y-3">
      <div className={`flex items-baseline justify-between gap-3 ${phoneTitle ? "" : "max-lg:hidden"}`}>
        <h2 className="eyebrow">{title}</h2>
        {hint && <span className="text-right text-xs text-ink-2">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, size = "md" }: {
  value: T;
  options: { id: T; label: ReactNode; disabled?: boolean; title?: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className={`segment ${size === "sm" ? "segment-sm" : ""}`}>
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          aria-pressed={o.id === value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange, disabled, hint }: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className={`flex items-center justify-between gap-4 text-sm ${disabled ? "opacity-45" : "cursor-pointer"}`}>
      <span>
        {label}
        {hint && <span className="block text-xs text-ink-2">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-line transition-colors duration-300 peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40" />
        <span className="toggle-knob absolute left-0.5 top-0.5 size-5 rounded-full bg-solid shadow-sm peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** medida con barra y campo numérico, en centímetros */
export function Dimension({ label, value, min, max, onChange, disabled, unit = "cm", hint }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (mm: number) => void;
  disabled?: boolean;
  unit?: string;
  /** una línea chica debajo del nombre (el mínimo y el máximo) */
  hint?: string;
}) {
  const cm = Math.round(value / 10);
  const [draft, setDraft] = useState(String(cm));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(String(cm));
  }, [cm]);

  // el número se aplica al confirmar: mientras se tipea "2" no tiene que
  // saltar al mínimo
  const commit = () => {
    editing.current = false;
    const n = Number(draft);
    if (Number.isFinite(n) && n > 0) onChange(n * 10);
    else setDraft(String(cm));
  };
  const id = `dim-${label.replace(/\s/g, "-")}`;
  const pct = ((value - min) / Math.max(1, max - min)) * 100;

  return (
    <div className={`space-y-2 ${disabled ? "pointer-events-none opacity-45" : ""}`}>
      <div className="flex items-center justify-between text-sm">
        {hint ? (
          <span>
            <label htmlFor={id} className="block text-base">
              {label}
            </label>
            <span className="text-xs text-ink-2">{hint}</span>
          </span>
        ) : (
          <label htmlFor={id}>{label}</label>
        )}
        <span className="flex items-center gap-1.5">
          <input
            id={id}
            inputMode="numeric"
            value={draft}
            onFocus={() => (editing.current = true)}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            className="w-[4.2rem] rounded-lg border border-line bg-paper px-2 py-1 text-right tabular-nums transition-colors focus:border-accent focus:outline-none"
          />
          <span className="w-6 text-ink-2">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        aria-label={`${label} en centímetros`}
        min={min / 10}
        max={max / 10}
        value={cm}
        onChange={(e) => onChange(Number(e.target.value) * 10)}
        className="range"
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
      />
    </div>
  );
}

export function Stepper({ label, value, min, max, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const btn =
    "grid size-8 place-items-center rounded-full border border-line text-lg leading-none transition-colors hover:border-ink-2 active:scale-95 disabled:opacity-30";
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-3">
        <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Menos ${label.toLowerCase()}`}>
          −
        </button>
        <span key={value} className="pop w-4 text-center tabular-nums">
          {value}
        </span>
        <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`Más ${label.toLowerCase()}`}>
          +
        </button>
      </span>
    </div>
  );
}

export function Swatches({ label, value, onChange }: { label: string; value: string; onChange: (id: string) => void }) {
  const current = catalog.materials.find((m) => m.id === value);
  return (
    <div className="space-y-2.5">
      <p className="text-sm">
        {label}: <span className="text-ink-2">{current?.name}</span>
      </p>
      <div className="flex flex-wrap gap-2.5">
        {catalog.materials.map((m) => (
          <button
            key={m.id}
            type="button"
            title={m.name}
            aria-label={m.name}
            aria-pressed={m.id === value}
            onClick={() => onChange(m.id)}
            className={`swatch size-10 rounded-full border-2 ${m.id === value ? "border-ink" : "border-surface ring-1 ring-line"}`}
            style={{
              background: m.grain
                ? `repeating-linear-gradient(100deg, ${m.color} 0 5px, color-mix(in srgb, ${m.color} 86%, black) 5px 6px, ${m.color} 6px 11px)`
                : m.color,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** tarjeta de opción con dibujito: forma, estilo de frente, layout */
export function OptionCard({ active, disabled, title, onClick, children, label }: {
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: ReactNode;
  label: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={`option-card flex flex-col items-center gap-1.5 rounded-2xl border px-1.5 py-2.5 text-[11px] leading-tight disabled:opacity-30 ${
        active ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-ink-2 hover:border-ink-2"
      }`}
    >
      {children}
      <span className="text-center">{label}</span>
    </button>
  );
}

/** número que llega al valor nuevo deslizándose, en vez de saltar */
export function useAnimatedNumber(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const current = useRef(value);
  useEffect(() => {
    from.current = current.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 520);
      // sale rápido y frena al llegar
      const eased = 1 - Math.pow(1 - t, 4);
      current.current = from.current + (value - from.current) * eased;
      setShown(current.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

/**
 * En el teléfono, el 3D ocupa la parte de arriba y los controles van abajo:
 * este botón lo agranda hasta casi toda la pantalla, para mirar el mueble, y
 * lo vuelve a achicar. En la computadora no hace falta.
 */
export function ExpandToggle({ big, onToggle }: { big: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={big}
      aria-label={big ? "Achicar el 3D" : "Agrandar el 3D"}
      title={big ? "Achicar el 3D" : "Agrandar el 3D"}
      className="tool px-2.5 lg:hidden"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {big ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
      </svg>
    </button>
  );
}

/** la pantalla es la de un teléfono parado (para acercar la cámara y agrandar el 3D) */
export function usePortraitPhone(): boolean {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 1023px) and (orientation: portrait)");
    const update = () => setPortrait(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  return portrait;
}

/** "Ajustar altura", "Ajustar largo": el nombre de una medida como la que se ajusta */
function adjustLabel(label: string): string {
  const named: Record<string, string> = { Alto: "altura" };
  return `Ajustar ${named[label] ?? label.charAt(0).toLowerCase() + label.slice(1)}`;
}

/**
 * Las medidas en el teléfono: una tarjeta por medida (Largo, Alto,
 * Profundidad) con su valor; la que se toca queda marcada y abajo aparece su
 * regla, con el mínimo y el máximo. Ocupa la mitad que tres reglas juntas.
 */
export function DimensionCards({ items, onChange }: { items: { key: string; label: string; value: number; min: number; max: number }[]; onChange: (key: string, mm: number) => void }) {
  const [active, setActive] = useState<string | null>(null);
  const current = items.find((i) => i.key === active) ?? items[0];
  if (!current) return null;
  return (
    <div className="space-y-3">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, minmax(0, 1fr))` }}>
        {items.map((i) => (
          <button key={i.key} type="button" aria-pressed={i.key === current.key} onClick={() => setActive(i.key)} className="dim-card">
            <span className="block truncate text-xs text-ink-2">{i.label}</span>
            <span className="block font-display text-xl leading-tight tabular-nums">{Math.round(i.value / 10)} cm</span>
          </button>
        ))}
      </div>
      <div className="rounded-2xl bg-paper p-4">
        <Dimension key={current.key} label={adjustLabel(current.label)} hint={`Mín: ${current.min / 10} cm · Máx: ${current.max / 10} cm`} value={current.value} min={current.min} max={current.max} onChange={(mm) => onChange(current.key, mm)} />
      </div>
    </div>
  );
}
