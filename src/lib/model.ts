import { catalog, type HandleType } from "./catalog.ts";

export type Layout =
  | "shelves"
  | "hanging"
  | "double-hanging"
  | "drawers-shelves"
  | "drawers-hanging";

export type DoorType = "none" | "hinged" | "sliding";

export type ModuleConfig = {
  layout: Layout;
  /** estantes libres (en los layouts que los usan) */
  shelves: number;
  /** cajones al pie (en los layouts que los usan) */
  drawers: number;
};

export type WardrobeConfig = {
  /** medidas exteriores en mm */
  width: number;
  height: number;
  depth: number;
  plinth: boolean;
  modules: ModuleConfig[];
  doors: DoorType;
  bodyMaterial: string;
  doorMaterial: string;
  handle: HandleType;
};

/**
 * Límites de fabricación. El alto tope sale de la placa: 2600 menos el
 * refilado deja 2580 útiles, y un lateral pasante tiene que entrar entero.
 * El ancho interior de módulo se queda entre 35 y 100 cm: más angosto no
 * entra una percha, más ancho el estante se flecha.
 */
export const LIMITS = {
  width: { min: 600, max: 4000 },
  height: { min: 1800, max: 2500 },
  depth: { min: 450, max: 650 },
  moduleInner: { min: 350, max: 1000 },
  shelves: { min: 0, max: 6 },
  drawers: { min: 0, max: 4 },
} as const;

export const PLINTH_HEIGHT = 80;
/** altura de cada cajón, frente más luz */
export const DRAWER_PITCH = 190;
/** distancia del techo interior al estante maletero */
export const TOP_SHELF_DROP = 350;
/** espacio mínimo para colgar una camisa */
export const HANG_MIN = 900;

export const LAYOUT_LABELS: Record<Layout, string> = {
  shelves: "Estantes",
  hanging: "Para colgar",
  "double-hanging": "Doble barral",
  "drawers-shelves": "Cajones y estantes",
  "drawers-hanging": "Cajones y barral",
};

export const DEFAULT_CONFIG: WardrobeConfig = {
  width: 2400,
  height: 2400,
  depth: 600,
  plinth: true,
  modules: [
    { layout: "hanging", shelves: 0, drawers: 0 },
    { layout: "drawers-shelves", shelves: 3, drawers: 3 },
    { layout: "double-hanging", shelves: 0, drawers: 0 },
  ],
  doors: "hinged",
  bodyMaterial: "blanco",
  doorMaterial: "roble",
  handle: "bar",
};

/** ancho interior de cada módulo cuando el placard se reparte en partes iguales */
export function innerModuleWidth(width: number, count: number): number {
  const t = catalog.board.thickness;
  return (width - (count + 1) * t) / count;
}

/** cantidades de módulos que respetan el ancho interior permitido */
export function validModuleCounts(width: number): number[] {
  const counts: number[] = [];
  for (let n = 1; n <= 8; n++) {
    const w = innerModuleWidth(width, n);
    if (w >= LIMITS.moduleInner.min && w <= LIMITS.moduleInner.max) counts.push(n);
  }
  return counts;
}

/** el módulo con menos espacio interior define si entra doble barral */
export function interiorHeight(config: Pick<WardrobeConfig, "height" | "plinth">): number {
  const t = catalog.board.thickness;
  return config.height - (config.plinth ? PLINTH_HEIGHT : 0) - 2 * t;
}

export function drawerZone(drawers: number): number {
  return drawers > 0 ? drawers * DRAWER_PITCH + 10 : 0;
}

/** qué layouts entran en el alto disponible */
export function layoutFits(layout: Layout, interior: number, drawers: number): boolean {
  const t = catalog.board.thickness;
  switch (layout) {
    case "double-hanging":
      return interior - TOP_SHELF_DROP - t >= 2 * HANG_MIN;
    case "drawers-hanging":
      return interior - TOP_SHELF_DROP - drawerZone(Math.max(1, drawers)) - 2 * t >= HANG_MIN;
    case "hanging":
      return interior - TOP_SHELF_DROP >= HANG_MIN;
    default:
      return true;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isLayout = (v: unknown): v is Layout =>
  typeof v === "string" && v in LAYOUT_LABELS;

/**
 * Deja cualquier configuración dentro de lo fabricable. Pasa por acá todo lo
 * que entra desde la interfaz o desde un link compartido: un link viejo o
 * editado a mano no puede romper el despiece.
 */
export function normalize(input: Partial<WardrobeConfig>): WardrobeConfig {
  const base = DEFAULT_CONFIG;
  const width = Math.round(clamp(Number(input.width) || base.width, LIMITS.width.min, LIMITS.width.max));
  const height = Math.round(clamp(Number(input.height) || base.height, LIMITS.height.min, LIMITS.height.max));
  const depth = Math.round(clamp(Number(input.depth) || base.depth, LIMITS.depth.min, LIMITS.depth.max));
  const plinth = typeof input.plinth === "boolean" ? input.plinth : base.plinth;

  const counts = validModuleCounts(width);
  const requested = Array.isArray(input.modules) ? input.modules.length : base.modules.length;
  const count = counts.reduce(
    (best, n) => (Math.abs(n - requested) < Math.abs(best - requested) ? n : best),
    counts[0],
  );

  const source = Array.isArray(input.modules) ? input.modules : base.modules;
  const interior = interiorHeight({ height, plinth });
  const modules: ModuleConfig[] = Array.from({ length: count }, (_, i) => {
    const m = source[i] ?? source[source.length - 1] ?? base.modules[0];
    const drawers = Math.round(clamp(Number(m?.drawers) || 0, LIMITS.drawers.min, LIMITS.drawers.max));
    const shelves = Math.round(clamp(Number(m?.shelves) || 0, LIMITS.shelves.min, LIMITS.shelves.max));
    let layout: Layout = isLayout(m?.layout) ? m.layout : "shelves";
    if (!layoutFits(layout, interior, drawers)) {
      layout = layout === "drawers-hanging" ? "drawers-shelves" : layoutFits("hanging", interior, 0) ? "hanging" : "shelves";
    }
    const usesDrawers = layout === "drawers-shelves" || layout === "drawers-hanging";
    return {
      layout,
      shelves,
      drawers: usesDrawers ? Math.max(1, drawers) : 0,
    };
  });

  const materialIds = catalog.materials.map((m) => m.id) as string[];
  const doors: DoorType = input.doors === "none" || input.doors === "sliding" ? input.doors : input.doors === "hinged" ? "hinged" : base.doors;
  const handle: HandleType = input.handle === "knob" || input.handle === "none" ? input.handle : input.handle === "bar" ? "bar" : base.handle;

  return {
    width,
    height,
    depth,
    plinth,
    modules,
    doors,
    bodyMaterial: materialIds.includes(String(input.bodyMaterial)) ? String(input.bodyMaterial) : base.bodyMaterial,
    doorMaterial: materialIds.includes(String(input.doorMaterial)) ? String(input.doorMaterial) : base.doorMaterial,
    handle,
  };
}
