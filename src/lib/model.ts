import { catalog, type HandleType } from "./catalog.ts";

export type Layout =
  | "shelves"
  | "hanging"
  | "double-hanging"
  | "drawers-shelves"
  | "drawers-hanging";

export type DoorType = "none" | "hinged" | "sliding";
export type DoorStyle = "flat" | "grooved" | "mirror" | "glass";
/** recto, o en L con el tramo lateral a la izquierda o a la derecha */
export type Shape = "straight" | "l-left" | "l-right";
export type LedColor = "warm" | "neutral" | "cool" | "rgb";

export type ModuleConfig = {
  layout: Layout;
  /** estantes libres (en los layouts que los usan) */
  shelves: number;
  /** cajones al pie (en los layouts que los usan) */
  drawers: number;
  /** ancho interior en mm */
  width: number;
  /** tira LED bajo cada estante y bajo el techo del módulo */
  ledShelves: boolean;
  /** perfil LED vertical en los dos laterales del módulo */
  ledSides: boolean;
};

export type RunConfig = {
  /** largo del tramo contra la pared, en mm. En el tramo lateral incluye la esquina */
  width: number;
  modules: ModuleConfig[];
};

export type WardrobeConfig = {
  shape: Shape;
  /** [frente] o [frente, lateral] */
  runs: RunConfig[];
  height: number;
  depth: number;
  plinth: boolean;
  /** altillo: cuerpo superior con sus propias puertas */
  topBox: { enabled: boolean; height: number };
  /** techo inclinado: el lado bajo mide `low` */
  slope: { enabled: boolean; low: number; side: "left" | "right" };
  /** estantes curvos abiertos en los extremos libres */
  curved: { left: boolean; right: boolean };
  doors: DoorType;
  doorStyle: DoorStyle;
  handle: HandleType;
  bodyMaterial: string;
  doorMaterial: string;
  led: { color: LedColor; rgb: string; sensor: boolean };
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
  topBox: { min: 300, max: 600 },
  /** el lado bajo del techo inclinado */
  slopeLow: { min: 1400 },
} as const;

export const PLINTH_HEIGHT = 80;
/** altura de cada cajón, frente más luz */
export const DRAWER_PITCH = 190;
/** distancia del techo interior al estante maletero */
export const TOP_SHELF_DROP = 350;
/** espacio mínimo para colgar una camisa */
export const HANG_MIN = 900;
/** cuánto sobresale un terminal curvo del costado del placard */
export const CURVE_RADIUS = 350;
/** puerta mínima que tiene que quedar al lado del panel ciego de esquina */
export const CORNER_DOOR_MIN = 300;

export const LAYOUT_LABELS: Record<Layout, string> = {
  shelves: "Estantes",
  hanging: "Para colgar",
  "double-hanging": "Doble barral",
  "drawers-shelves": "Cajones y estantes",
  "drawers-hanging": "Cajones y barral",
};

export const DOOR_STYLE_LABELS: Record<DoorStyle, string> = {
  flat: "Liso",
  grooved: "Ranurado",
  mirror: "Espejo",
  glass: "Vidrio y aluminio",
};

export const LED_COLORS: Record<Exclude<LedColor, "rgb">, { label: string; hex: string }> = {
  warm: { label: "Cálida", hex: "#ffb36b" },
  neutral: { label: "Neutra", hex: "#fff0dc" },
  cool: { label: "Fría", hex: "#dce8ff" },
};

const mod = (layout: Layout, extra: Partial<ModuleConfig> = {}): ModuleConfig => ({
  layout,
  shelves: 0,
  drawers: 0,
  width: 0,
  ledShelves: false,
  ledSides: false,
  ...extra,
});

/** valores de partida tal cual se escriben; DEFAULT_CONFIG es esto ya normalizado */
const RAW_DEFAULT: WardrobeConfig = {
  shape: "straight",
  runs: [
    {
      width: 2400,
      modules: [
        mod("hanging", { ledShelves: true }),
        mod("drawers-shelves", { shelves: 3, drawers: 3, ledShelves: true }),
        mod("double-hanging", { ledShelves: true }),
      ],
    },
  ],
  height: 2400,
  depth: 600,
  plinth: true,
  topBox: { enabled: false, height: 450 },
  slope: { enabled: false, low: 1800, side: "right" },
  curved: { left: false, right: false },
  doors: "hinged",
  doorStyle: "flat",
  handle: "bar",
  bodyMaterial: "blanco",
  doorMaterial: "roble",
  led: { color: "warm", rgb: "#7c5cff", sensor: true },
};

const T = () => catalog.board.thickness;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isLayout = (v: unknown): v is Layout => typeof v === "string" && v in LAYOUT_LABELS;

/**
 * Largo útil de un tramo. El lateral de un placard en L arranca delante del
 * tramo de frente, así que pierde la profundidad de la esquina.
 */
export function runSpan(config: Pick<WardrobeConfig, "depth">, run: number, width: number): number {
  return run === 1 ? width - config.depth : width;
}

/** cuál módulo del tramo de frente queda en la esquina, o null si es recto */
export function cornerModule(shape: Shape, count: number): number | null {
  if (shape === "l-left") return 0;
  if (shape === "l-right") return count - 1;
  return null;
}

export function moduleMin(config: Pick<WardrobeConfig, "shape" | "depth">, run: number, index: number, count: number): number {
  if (run === 0 && cornerModule(config.shape, count) === index) {
    return Math.max(LIMITS.moduleInner.min, config.depth + CORNER_DOOR_MIN);
  }
  return LIMITS.moduleInner.min;
}

/** suma de anchos interiores disponible para los módulos de un tramo */
export function innerAvailable(span: number, count: number): number {
  return span - (count + 1) * T();
}

/** cantidades de módulos que respetan los anchos interiores permitidos */
export function validModuleCounts(config: Pick<WardrobeConfig, "shape" | "depth">, run: number, span: number): number[] {
  const counts: number[] = [];
  for (let n = 1; n <= 10; n++) {
    const avail = innerAvailable(span, n);
    let minSum = 0;
    for (let i = 0; i < n; i++) minSum += moduleMin(config, run, i, n);
    if (avail >= minSum && avail <= n * LIMITS.moduleInner.max) counts.push(n);
  }
  return counts;
}

/**
 * Reparte `total` entre los módulos respetando el mínimo y el máximo de cada
 * uno, en proporción a lo que cada uno pedía. Es un llenado por niveles: los
 * que tocan un límite quedan fijos y el resto se reparte entre los demás.
 */
export function distribute(requested: number[], mins: number[], maxs: number[], total: number, fixed: (number | null)[] = []): number[] {
  const n = requested.length;
  const out = new Array<number>(n).fill(0);
  const locked = new Array<boolean>(n).fill(false);
  let remaining = total;
  fixed.forEach((v, i) => {
    if (v !== null && v !== undefined) {
      out[i] = clamp(v, mins[i], maxs[i]);
      locked[i] = true;
      remaining -= out[i];
    }
  });
  for (let guard = 0; guard < n + 2; guard++) {
    const free = [...Array(n).keys()].filter((i) => !locked[i]);
    if (!free.length) break;
    const weight = free.reduce((s, i) => s + Math.max(1, requested[i]), 0);
    let changed = false;
    for (const i of free) out[i] = (remaining * Math.max(1, requested[i])) / weight;
    for (const i of free) {
      if (out[i] < mins[i] || out[i] > maxs[i]) {
        out[i] = clamp(out[i], mins[i], maxs[i]);
        locked[i] = true;
        remaining -= out[i];
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

/** posición x (desde el borde izquierdo del tramo) del inicio interior de cada módulo */
export function moduleOffsets(modules: Pick<ModuleConfig, "width">[]): number[] {
  const t = T();
  const xs: number[] = [];
  let x = t;
  for (const m of modules) {
    xs.push(x);
    x += m.width + t;
  }
  return xs;
}

/** alto del placard en el punto x del tramo de frente (cambia con techo inclinado) */
export function heightAt(config: Pick<WardrobeConfig, "height" | "slope" | "runs">, x: number): number {
  if (!config.slope.enabled) return config.height;
  const w = config.runs[0].width;
  const f = clamp(x / w, 0, 1);
  const drop = config.height - config.slope.low;
  return config.slope.side === "left" ? config.slope.low + drop * f : config.height - drop * f;
}

/** espacio interior libre de un módulo, contando el lado más bajo si hay pendiente */
export function moduleInterior(config: WardrobeConfig, run: number, index: number): number {
  const t = T();
  const z = config.plinth ? PLINTH_HEIGHT : 0;
  const m = config.runs[run].modules;
  const x0 = moduleOffsets(m)[index];
  const top = run === 0 ? Math.min(heightAt(config, x0), heightAt(config, x0 + m[index].width)) : config.height;
  // con pendiente el techo va inclinado: se pierde un poco más que el espesor
  return top - z - 2 * t - (config.slope.enabled ? 20 : 0);
}

export function drawerZone(drawers: number): number {
  return drawers > 0 ? drawers * DRAWER_PITCH + 10 : 0;
}

/** qué layouts entran en el alto disponible */
export function layoutFits(layout: Layout, interior: number, drawers: number): boolean {
  const t = T();
  switch (layout) {
    case "double-hanging":
      return interior - TOP_SHELF_DROP - t >= 2 * HANG_MIN;
    case "drawers-hanging":
      return interior - TOP_SHELF_DROP - drawerZone(Math.max(1, drawers)) - 2 * t >= HANG_MIN;
    case "hanging":
      return interior - TOP_SHELF_DROP >= HANG_MIN;
    case "drawers-shelves":
      return interior - drawerZone(Math.max(1, drawers)) - t >= 250;
    default:
      return true;
  }
}

/** altura total, con altillo si lo hay */
export function totalHeight(config: WardrobeConfig): number {
  return config.height + (config.topBox.enabled ? config.topBox.height : 0);
}

function normalizeModule(m: Partial<ModuleConfig> | undefined, fallback: ModuleConfig): ModuleConfig {
  const src = m ?? fallback;
  return {
    layout: isLayout(src.layout) ? src.layout : "shelves",
    shelves: Math.round(clamp(Number(src.shelves) || 0, LIMITS.shelves.min, LIMITS.shelves.max)),
    drawers: Math.round(clamp(Number(src.drawers) || 0, LIMITS.drawers.min, LIMITS.drawers.max)),
    width: Math.max(0, Number(src.width) || 0),
    ledShelves: Boolean(src.ledShelves),
    ledSides: Boolean(src.ledSides),
  };
}

/** el que pide el menor cambio de cantidad de módulos entre los válidos */
function nearestCount(counts: number[], requested: number): number {
  return counts.reduce((best, n) => (Math.abs(n - requested) < Math.abs(best - requested) ? n : best), counts[0]);
}

/**
 * Deja cualquier configuración dentro de lo fabricable. Pasa por acá todo lo
 * que entra desde la interfaz o desde un link compartido: un link viejo o
 * editado a mano no puede romper el despiece.
 */
export function normalize(input: Partial<WardrobeConfig> & { width?: number; modules?: Partial<ModuleConfig>[] }): WardrobeConfig {
  const base = RAW_DEFAULT;
  const shape: Shape = input.shape === "l-left" || input.shape === "l-right" ? input.shape : "straight";
  const depth = Math.round(clamp(Number(input.depth) || base.depth, LIMITS.depth.min, LIMITS.depth.max));
  const height = Math.round(clamp(Number(input.height) || base.height, LIMITS.height.min, LIMITS.height.max));
  const plinth = typeof input.plinth === "boolean" ? input.plinth : base.plinth;

  // links de la primera versión: un solo tramo con width y modules sueltos
  const rawRuns: Partial<RunConfig>[] = Array.isArray(input.runs)
    ? input.runs
    : [{ width: input.width ?? base.runs[0].width, modules: (input.modules as ModuleConfig[]) ?? base.runs[0].modules }];

  const slopeIn = input.slope ?? base.slope;
  const slopeEnabled = shape === "straight" && Boolean(slopeIn.enabled);
  const slope = {
    enabled: slopeEnabled,
    side: slopeIn.side === "left" ? ("left" as const) : ("right" as const),
    low: Math.round(clamp(Number(slopeIn.low) || base.slope.low, LIMITS.slopeLow.min, height - 100)),
  };

  const topIn = input.topBox ?? base.topBox;
  const topBox = {
    enabled: !slopeEnabled && Boolean(topIn.enabled),
    height: Math.round(clamp(Number(topIn.height) || base.topBox.height, LIMITS.topBox.min, LIMITS.topBox.max)),
  };

  const partial = { shape, depth } as const;
  const runCount = shape === "straight" ? 1 : 2;
  const runs: RunConfig[] = Array.from({ length: runCount }, (_, r) => {
    const raw = rawRuns[r] ?? (r === 1 ? { width: Math.max(depth + 1200, 1500), modules: [base.runs[0].modules[0], base.runs[0].modules[2]] } : base.runs[0]);
    const minWidth = r === 1 ? depth + LIMITS.width.min : LIMITS.width.min;
    const width = Math.round(clamp(Number(raw.width) || base.runs[0].width, minWidth, LIMITS.width.max));
    const span = runSpan({ depth }, r, width);
    const counts = validModuleCounts(partial, r, span);
    const source = Array.isArray(raw.modules) && raw.modules.length ? raw.modules : base.runs[0].modules;
    const count = nearestCount(counts, source.length);
    const modules = Array.from({ length: count }, (_, i) => normalizeModule(source[i], normalizeModule(source[source.length - 1], base.runs[0].modules[0])));

    const avail = innerAvailable(span, count);
    const mins = modules.map((_, i) => moduleMin(partial, r, i, count));
    const maxs = modules.map(() => LIMITS.moduleInner.max);
    const sameCount = source.length === count && source.every((m) => Number(m?.width) > 0);
    const requested = sameCount ? modules.map((m) => m.width) : modules.map(() => avail / count);
    distribute(requested, mins, maxs, avail).forEach((w, i) => (modules[i].width = Math.round(w * 10) / 10));
    return { width, modules };
  });

  const doorsIn = input.doors === "none" || input.doors === "sliding" ? input.doors : input.doors === "hinged" ? "hinged" : base.doors;
  // con techo inclinado las hojas corredizas no corren: van batientes
  const doors: DoorType = slopeEnabled && doorsIn === "sliding" ? "hinged" : doorsIn;
  const styleIn: DoorStyle = input.doorStyle && input.doorStyle in DOOR_STYLE_LABELS ? input.doorStyle : base.doorStyle;
  // el marco de aluminio es rectangular: con pendiente, la puerta va lisa
  const doorStyle: DoorStyle = slopeEnabled && styleIn === "glass" ? "flat" : styleIn;
  const handle: HandleType = input.handle === "knob" || input.handle === "none" ? input.handle : input.handle === "bar" ? "bar" : base.handle;

  const materialIds = catalog.materials.map((m) => m.id) as string[];
  const curvedIn = input.curved ?? base.curved;
  const ledIn = input.led ?? base.led;
  const config: WardrobeConfig = {
    shape,
    runs,
    height,
    depth,
    plinth,
    topBox,
    slope,
    curved: { left: Boolean(curvedIn.left), right: Boolean(curvedIn.right) },
    doors,
    doorStyle,
    handle,
    bodyMaterial: materialIds.includes(String(input.bodyMaterial)) ? String(input.bodyMaterial) : base.bodyMaterial,
    doorMaterial: materialIds.includes(String(input.doorMaterial)) ? String(input.doorMaterial) : base.doorMaterial,
    led: {
      color: ledIn.color === "neutral" || ledIn.color === "cool" || ledIn.color === "rgb" ? ledIn.color : "warm",
      rgb: /^#[0-9a-f]{6}$/i.test(String(ledIn.rgb)) ? String(ledIn.rgb) : base.led.rgb,
      sensor: typeof ledIn.sensor === "boolean" ? ledIn.sensor : base.led.sensor,
    },
  };

  // el layout de cada módulo tiene que entrar en su alto, que con pendiente varía
  config.runs.forEach((run, r) =>
    run.modules.forEach((m, i) => {
      const interior = moduleInterior(config, r, i);
      if (!layoutFits(m.layout, interior, m.drawers)) {
        m.layout =
          m.layout === "drawers-hanging" && layoutFits("drawers-shelves", interior, m.drawers)
            ? "drawers-shelves"
            : layoutFits("hanging", interior, 0) && m.layout !== "drawers-shelves"
              ? "hanging"
              : "shelves";
      }
      const usesDrawers = m.layout === "drawers-shelves" || m.layout === "drawers-hanging";
      m.drawers = usesDrawers ? Math.max(1, m.drawers) : 0;
      if (usesDrawers) {
        // que los cajones no se coman todo el módulo
        while (m.drawers > 1 && !layoutFits(m.layout, interior, m.drawers)) m.drawers -= 1;
      }
      if (m.layout === "shelves") m.shelves = Math.max(1, m.shelves);
    }),
  );

  return config;
}

/** cambia la cantidad de módulos de un tramo repartiendo el ancho en partes iguales */
export function withModuleCount(config: WardrobeConfig, run: number, count: number): WardrobeConfig {
  const current = config.runs[run].modules;
  const modules = Array.from({ length: count }, (_, i) => ({ ...(current[i] ?? current[current.length - 1]), width: 0 }));
  return normalize({ ...config, runs: config.runs.map((r, j) => (j === run ? { ...r, modules } : r)) });
}

/** ensancha un módulo y achica los demás para que el total no cambie */
export function withModuleWidth(config: WardrobeConfig, run: number, index: number, width: number): WardrobeConfig {
  const r = config.runs[run];
  const n = r.modules.length;
  const span = runSpan(config, run, r.width);
  const avail = innerAvailable(span, n);
  const mins = r.modules.map((_, i) => moduleMin(config, run, i, n));
  const maxs = r.modules.map(() => LIMITS.moduleInner.max);
  // el pedido no puede dejar a los demás por debajo de su mínimo
  const othersMin = mins.reduce((s, m, i) => (i === index ? s : s + m), 0);
  const othersMax = maxs.reduce((s, m, i) => (i === index ? s : s + m), 0);
  const target = clamp(width, Math.max(mins[index], avail - othersMax), Math.min(maxs[index], avail - othersMin));
  const widths = distribute(
    r.modules.map((m) => m.width),
    mins,
    maxs,
    avail,
    r.modules.map((_, i) => (i === index ? target : null)),
  );
  const modules = r.modules.map((m, i) => ({ ...m, width: widths[i] }));
  return normalize({ ...config, runs: config.runs.map((x, j) => (j === run ? { ...x, modules } : x)) });
}

export function ledHex(config: Pick<WardrobeConfig, "led">): string {
  return config.led.color === "rgb" ? config.led.rgb : LED_COLORS[config.led.color].hex;
}

export function hasLeds(config: WardrobeConfig): boolean {
  return config.runs.some((r) => r.modules.some((m) => m.ledShelves || m.ledSides));
}

/** la configuración de arranque, con los anchos de módulo ya repartidos */
export const DEFAULT_CONFIG: WardrobeConfig = normalize(RAW_DEFAULT);
