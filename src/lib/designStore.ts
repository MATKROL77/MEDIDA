"use client";

/**
 * Guardado de diseños en este dispositivo, sin cuenta.
 *
 * Vive en el almacenamiento local del navegador: sobrevive a recargar la
 * página y a cerrar el navegador, y se ve igual en todas las pestañas. Con una
 * cuenta, además se sincroniza con el servidor (sync.ts).
 */

import { useSyncExternalStore } from "react";

import {
  EMPTY_STATE,
  duplicateDesign,
  patchDesign,
  removeDesign,
  sanitizeState,
  upsertDesign,
  type DesignState,
  type DesignSummary,
  type SavedDesign,
} from "./designs.ts";

const KEY = "medida.designs.v1";
const DRAFT_PREFIX = "medida.draft.";
const EVENT = "medida:designs";

let cache: { raw: string | null; state: DesignState } | null = null;

function read(): DesignState {
  if (typeof window === "undefined") return EMPTY_STATE;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache?.state ?? EMPTY_STATE;
  }
  if (cache && cache.raw === raw) return cache.state;
  let state = EMPTY_STATE;
  if (raw) {
    try {
      state = sanitizeState(JSON.parse(raw));
    } catch {
      state = EMPTY_STATE;
    }
  }
  cache = { raw, state };
  return state;
}

/**
 * Escribe el estado. Si no entra en el almacenamiento, saca las vistas
 * previas de los diseños más viejos hasta que entre: se pierde la foto, nunca
 * el diseño.
 */
function write(state: DesignState): boolean {
  let next = state;
  for (let attempt = 0; attempt <= state.designs.length; attempt++) {
    const raw = JSON.stringify(next);
    try {
      window.localStorage.setItem(KEY, raw);
      cache = { raw, state: next };
      window.dispatchEvent(new Event(EVENT));
      return true;
    } catch {
      const victim = [...next.designs].reverse().find((d) => d.preview !== null);
      if (!victim) break;
      next = { ...next, designs: next.designs.map((d) => (d.id === victim.id ? { ...d, preview: null } : d)) };
    }
  }
  // sin almacenamiento (modo privado estricto): queda en memoria para esta visita
  cache = { raw: cache?.raw ?? null, state };
  window.dispatchEvent(new Event(EVENT));
  return false;
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onChange);
  };
}

/** el estado guardado, vivo: se actualiza solo si cambia en otra pestaña */
export function useDesigns(): DesignState {
  return useSyncExternalStore(subscribe, read, () => EMPTY_STATE);
}

export const getDesigns = read;
export const setDesigns = write;

export function getDesign(id: string): SavedDesign | null {
  return read().designs.find((d) => d.id === id) ?? null;
}

export type NewDesign = {
  type: string;
  name: string;
  config: unknown;
  summary: DesignSummary;
  price: number | null;
  preview: string | null;
  favorite?: boolean;
  cart?: boolean;
};

export function addDesign(input: NewDesign): SavedDesign {
  const now = Date.now();
  const design: SavedDesign = {
    id: crypto.randomUUID(),
    type: input.type,
    name: input.name,
    config: input.config,
    summary: input.summary,
    price: input.price,
    preview: input.preview,
    favorite: input.favorite ?? false,
    cart: input.cart ?? false,
    createdAt: now,
    updatedAt: now,
  };
  write(upsertDesign(read(), design));
  return design;
}

export function updateDesign(id: string, patch: Partial<Omit<SavedDesign, "id" | "createdAt">>) {
  write(patchDesign(read(), id, patch, Date.now()));
}

export function deleteDesign(id: string) {
  write(removeDesign(read(), id, Date.now()));
}

export function copyDesign(id: string): string {
  const newId = crypto.randomUUID();
  write(duplicateDesign(read(), id, newId, Date.now()));
  return newId;
}

/** nombre de partida para un diseño nuevo: "Placard 3" */
export function nextName(label: string): string {
  const taken = new Set(read().designs.map((d) => d.name));
  for (let n = 1; ; n++) {
    const name = `${label} ${n}`;
    if (!taken.has(name)) return name;
  }
}

// --- borrador: lo último que se estaba armando, aunque no se haya guardado

export function readDraft<T>(type: string): { config: T; at: number } | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_PREFIX + type);
    if (!raw) return null;
    const d = JSON.parse(raw) as { config?: T; at?: number };
    return d && typeof d.config === "object" && d.config !== null && typeof d.at === "number" ? { config: d.config, at: d.at } : null;
  } catch {
    return null;
  }
}

export function writeDraft(type: string, config: unknown) {
  try {
    window.localStorage.setItem(DRAFT_PREFIX + type, JSON.stringify({ config, at: Date.now() }));
  } catch {
    // sin almacenamiento el borrador queda en la dirección de la página
  }
}

export function clearDraft(type: string) {
  try {
    window.localStorage.removeItem(DRAFT_PREFIX + type);
  } catch {
    // nada que borrar
  }
}
