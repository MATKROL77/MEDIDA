"use client";

import Link from "next/link";
import { useState } from "react";

import { Sheet } from "@/components/site/Sheet";
import { IconBag, IconHeart } from "@/components/site/icons";
import { LIMITS, shortCode, type SavedDesign } from "@/lib/designs";

export type SaveChoice = { name: string; favorite: boolean; cart: boolean };

/**
 * Guardar el diseño que se está armando: con qué nombre y dónde. Queda en el
 * dispositivo, sin pedir registro.
 */
export function SaveSheet({ saved, suggestedName, onSave, onClose }: {
  /** el diseño ya guardado que se está editando, si lo hay */
  saved: SavedDesign | null;
  suggestedName: string;
  onSave: (choice: SaveChoice) => void | Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(saved?.name ?? suggestedName);
  const [favorite, setFavorite] = useState(saved ? saved.favorite : true);
  const [cart, setCart] = useState(saved ? saved.cart : false);
  const [busy, setBusy] = useState(false);
  const nowhere = !favorite && !cart;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || nowhere) return;
    setBusy(true);
    await onSave({ name: name.trim() || suggestedName, favorite, cart });
  };

  return (
    <Sheet title={saved ? "Tu diseño guardado" : "Guardar este diseño"} eyebrow={saved ? shortCode(saved.id) : undefined} onClose={onClose}>
      <form onSubmit={submit} className="mt-5 space-y-5">
        <div>
          <label htmlFor="design-name" className="text-sm font-medium">
            Nombre
          </label>
          <input id="design-name" className="field mt-2" value={name} maxLength={LIMITS.name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Dónde lo guardás</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Choice checked={favorite} onChange={setFavorite} icon={<IconHeart filled={favorite} />} title="Favoritos" body="Para compararlo con otros y volver cuando quieras." />
            <Choice checked={cart} onChange={setCart} icon={<IconBag />} title="Carrito de consulta" body="Para pedir cotización de varios muebles juntos. No es una compra." />
          </div>
          {nowhere && <p className="mt-2 text-xs text-accent-strong">Elegí al menos uno.</p>}
        </fieldset>

        <p className="text-xs leading-relaxed text-ink-2">
          Queda guardado en este dispositivo, con sus medidas, materiales y una vista previa. No hace falta registrarse.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary disabled:opacity-50" disabled={busy || nowhere}>
            {busy ? "Guardando…" : saved ? "Guardar cambios" : "Guardar"}
          </button>
          {saved && (
            <Link href="/mis-disenos/" className="link-arrow text-sm">
              Ver mis diseños
            </Link>
          )}
        </div>
      </form>
    </Sheet>
  );
}

function Choice({ checked, onChange, icon, title, body }: { checked: boolean; onChange: (v: boolean) => void; icon: React.ReactNode; title: string; body: string }) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors duration-200 ${checked ? "border-ink bg-paper" : "border-line hover:border-ink-3"}`}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={`mt-0.5 shrink-0 ${checked ? "text-accent" : "text-ink-3"}`}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-2">{body}</span>
      </span>
    </label>
  );
}
