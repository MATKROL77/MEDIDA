/**
 * Diseños guardados: favoritos y carrito de consulta.
 *
 * Un diseño guardado es la configuración completa de un mueble más lo que
 * hace falta para listarlo sin cargar el motor 3D (resumen, precio estimado,
 * vista previa). Estas funciones son puras: el almacenamiento vive en
 * designStore.ts y el servidor usa las mismas reglas de fusión.
 */

export type DesignSummary = {
  /** "240 × 240 × 60 cm" */
  dimensions: string;
  /** forma, módulos, frentes, materiales, luces: una línea cada cosa */
  lines: string[];
};

export type SavedDesign = {
  /** identificador único de la configuración */
  id: string;
  /** familia de producto: "placares" */
  type: string;
  name: string;
  /** la configuración tal cual la entiende el configurador de esa familia */
  config: unknown;
  summary: DesignSummary;
  /** precio estimado al guardar, en pesos; null si la familia no calcula precio */
  price: number | null;
  /** imagen chica del 3D (data URL), o null si no se pudo capturar */
  preview: string | null;
  favorite: boolean;
  cart: boolean;
  createdAt: number;
  updatedAt: number;
};

/** marca de un diseño borrado, para que el borrado llegue a los otros dispositivos */
export type Tombstone = { id: string; deletedAt: number };

export type DesignState = { designs: SavedDesign[]; tombstones: Tombstone[] };

export const EMPTY_STATE: DesignState = { designs: [], tombstones: [] };

export const LIMITS = {
  designs: 60,
  name: 80,
  /** bytes de la configuración serializada */
  config: 32_000,
  /** caracteres de la vista previa (data URL) */
  preview: 160_000,
  summaryLines: 12,
  summaryLine: 160,
} as const;

/** "MD-7F3A2C": para nombrar un diseño en una consulta sin pegar el identificador entero */
export function shortCode(id: string): string {
  return `MD-${id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isTime = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const ID = /^[a-zA-Z0-9-]{8,64}$/;

/**
 * Valida un diseño que viene de afuera (el almacenamiento del navegador o el
 * servidor). Devuelve null si no se puede usar; nunca lanza.
 */
export function sanitizeDesign(raw: unknown): SavedDesign | null {
  if (!isObject(raw)) return null;
  const { id, type, name, config, summary, price, preview, favorite, cart, createdAt, updatedAt } = raw;
  if (typeof id !== "string" || !ID.test(id)) return null;
  if (typeof type !== "string" || !/^[a-z0-9-]{1,40}$/.test(type)) return null;
  if (!isObject(config)) return null;
  if (!isTime(createdAt) || !isTime(updatedAt)) return null;
  let configSize: number;
  try {
    configSize = JSON.stringify(config).length;
  } catch {
    return null;
  }
  if (configSize > LIMITS.config) return null;
  const s = isObject(summary) ? summary : {};
  const lines = Array.isArray(s.lines) ? s.lines.filter((l): l is string => typeof l === "string") : [];
  const image = typeof preview === "string" && /^data:image\/(jpeg|webp|png);base64,/.test(preview) && preview.length <= LIMITS.preview ? preview : null;
  return {
    id,
    type,
    name: (typeof name === "string" ? name : "").trim().slice(0, LIMITS.name) || "Diseño sin nombre",
    config,
    summary: {
      dimensions: typeof s.dimensions === "string" ? s.dimensions.slice(0, LIMITS.summaryLine) : "",
      lines: lines.slice(0, LIMITS.summaryLines).map((l) => l.slice(0, LIMITS.summaryLine)),
    },
    price: typeof price === "number" && Number.isFinite(price) && price >= 0 ? Math.round(price) : null,
    preview: image,
    favorite: favorite === true,
    cart: cart === true,
    createdAt,
    updatedAt,
  };
}

export function sanitizeState(raw: unknown): DesignState {
  if (!isObject(raw)) return EMPTY_STATE;
  const designs = (Array.isArray(raw.designs) ? raw.designs : []).map(sanitizeDesign).filter((d): d is SavedDesign => d !== null);
  const tombstones = (Array.isArray(raw.tombstones) ? raw.tombstones : []).filter(
    (t): t is Tombstone => isObject(t) && typeof t.id === "string" && ID.test(t.id) && isTime(t.deletedAt),
  );
  return { designs: dedupe(designs), tombstones };
}

/** un diseño por identificador: gana el modificado más recientemente */
function dedupe(designs: SavedDesign[]): SavedDesign[] {
  const byId = new Map<string, SavedDesign>();
  for (const d of designs) {
    const cur = byId.get(d.id);
    if (!cur || d.updatedAt > cur.updatedAt) byId.set(d.id, d);
  }
  return sortDesigns([...byId.values()]);
}

/** los modificados hace menos, primero */
export function sortDesigns(designs: SavedDesign[]): SavedDesign[] {
  return [...designs].sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

/** agrega o reemplaza un diseño; si se pasa el tope, salen los más viejos que no están marcados */
export function upsertDesign(state: DesignState, design: SavedDesign): DesignState {
  const others = state.designs.filter((d) => d.id !== design.id);
  let designs = sortDesigns([design, ...others]);
  if (designs.length > LIMITS.designs) {
    const keep = new Set(designs.slice(0, LIMITS.designs).map((d) => d.id));
    designs = designs.filter((d) => keep.has(d.id) || d.id === design.id);
  }
  return { designs, tombstones: state.tombstones.filter((t) => t.id !== design.id) };
}

export function patchDesign(state: DesignState, id: string, patch: Partial<Omit<SavedDesign, "id" | "createdAt">>, now: number): DesignState {
  const cur = state.designs.find((d) => d.id === id);
  if (!cur) return state;
  return upsertDesign(state, { ...cur, ...patch, id, createdAt: cur.createdAt, updatedAt: now });
}

export function removeDesign(state: DesignState, id: string, now: number): DesignState {
  if (!state.designs.some((d) => d.id === id)) return state;
  return {
    designs: state.designs.filter((d) => d.id !== id),
    tombstones: [...state.tombstones.filter((t) => t.id !== id), { id, deletedAt: now }],
  };
}

/** una copia con otro identificador; conserva dónde estaba guardado el original */
export function duplicateDesign(state: DesignState, id: string, newId: string, now: number): DesignState {
  const cur = state.designs.find((d) => d.id === id);
  if (!cur) return state;
  const base = cur.name.replace(/ \(copia(?: \d+)?\)$/, "");
  const taken = new Set(state.designs.map((d) => d.name));
  let name = `${base} (copia)`;
  for (let n = 2; taken.has(name); n++) name = `${base} (copia ${n})`;
  return upsertDesign(state, { ...cur, id: newId, name: name.slice(0, LIMITS.name), createdAt: now, updatedAt: now });
}

/**
 * Junta lo de este dispositivo con lo del servidor. Para cada diseño gana la
 * versión modificada más tarde; un borrado gana si es posterior a la última
 * modificación.
 */
export function mergeStates(local: DesignState, remote: DesignState): DesignState {
  const tombs = new Map<string, number>();
  for (const t of [...local.tombstones, ...remote.tombstones]) tombs.set(t.id, Math.max(tombs.get(t.id) ?? 0, t.deletedAt));
  const byId = new Map<string, SavedDesign>();
  for (const d of [...local.designs, ...remote.designs]) {
    const cur = byId.get(d.id);
    if (!cur || d.updatedAt > cur.updatedAt) byId.set(d.id, d);
  }
  const designs: SavedDesign[] = [];
  for (const d of byId.values()) {
    const deletedAt = tombs.get(d.id);
    if (deletedAt !== undefined && deletedAt >= d.updatedAt) continue;
    // revivió después del borrado: la marca ya no vale
    tombs.delete(d.id);
    designs.push(d);
  }
  return {
    designs: sortDesigns(designs).slice(0, LIMITS.designs),
    tombstones: [...tombs.entries()].map(([id, deletedAt]) => ({ id, deletedAt })),
  };
}

export const favoritesOf = (state: DesignState) => state.designs.filter((d) => d.favorite);
export const cartOf = (state: DesignState) => state.designs.filter((d) => d.cart);

/** suma de los precios estimados del carrito; null si ninguno tiene precio */
export function cartTotal(state: DesignState): number | null {
  const priced = cartOf(state).filter((d) => d.price !== null);
  return priced.length ? priced.reduce((s, d) => s + (d.price ?? 0), 0) : null;
}
