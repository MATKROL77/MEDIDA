/**
 * Los otros muebles: mesas y escritorios, ratonas y mesas de luz, muebles de
 * TV, bibliotecas y sillones modulares.
 *
 * Cada familia se describe con parámetros (qué medidas y opciones tiene) y
 * una función que arma el mueble pieza por pieza, con las mismas piezas que
 * usa el placard. Por eso el 3D, la vista explotada, los cajones que se abren
 * y el despiece son los mismos para todos: no hay un motor por mueble.
 *
 * Medidas en mm: x a lo largo, y hacia arriba, z hacia el frente.
 */

import type { Assembly, Cut, Part, PartKind, Vec3 } from "./assembly.ts";
import { catalog, materialById } from "./catalog.ts";
import type { DesignSummary } from "./designs.ts";

export type Value = number | string | boolean;

export type Control =
  | { key: string; type: "size"; label: string; min: number; max: number }
  | { key: string; type: "count"; label: string; min: number; max: number }
  | { key: string; type: "choice"; label: string; options: { id: string; label: string }[] }
  | { key: string; type: "toggle"; label: string; hint?: string };

export type FurnitureConfig = {
  family: string;
  values: Record<string, Value>;
  /** terminación del cuerpo y de los frentes (o de la tapa) */
  body: string;
  front: string;
  /** color del tapizado, en los sillones */
  fabric: string;
};

export type FurnitureSpec = {
  id: string;
  /** "Mesa", "Biblioteca": para nombrar un diseño guardado */
  label: string;
  title: string;
  controls: Control[];
  defaults: Record<string, Value>;
  body: string;
  front: string;
  /** cómo se llaman las dos terminaciones en esta familia */
  bodyLabel: string;
  frontLabel: string | null;
  upholstered?: boolean;
};

export const FABRICS = [
  { id: "arena", name: "Lino arena", color: "#cdbfa9" },
  { id: "gris", name: "Gris piedra", color: "#8e8f8c" },
  { id: "grafito", name: "Grafito", color: "#45474a" },
  { id: "terracota", name: "Terracota", color: "#b0694b" },
  { id: "oliva", name: "Verde oliva", color: "#6f7558" },
  { id: "azul", name: "Azul noche", color: "#39475a" },
] as const;

export const fabricById = (id: string) => FABRICS.find((f) => f.id === id) ?? FABRICS[0];

const choice = (...pairs: [string, string][]) => pairs.map(([id, label]) => ({ id, label }));

export const SPECS: FurnitureSpec[] = [
  {
    id: "mesas",
    label: "Mesa",
    title: "Mesas y escritorios",
    controls: [
      // la tapa es una sola pieza: tiene que entrar en la placa refilada (2580 mm)
      { key: "width", type: "size", label: "Largo", min: 900, max: 2500 },
      { key: "depth", type: "size", label: "Ancho", min: 550, max: 1100 },
      { key: "height", type: "size", label: "Alto", min: 700, max: 1100 },
      { key: "legs", type: "choice", label: "Patas", options: choice(["madera", "De madera"], ["panel", "Laterales llenos"], ["metal", "De hierro"]) },
      { key: "drawers", type: "toggle", label: "Cajonera", hint: "Para usarla de escritorio" },
    ],
    defaults: { width: 1600, depth: 750, height: 750, legs: "madera", drawers: false },
    body: "grafito",
    front: "roble",
    bodyLabel: "Patas y estructura",
    frontLabel: "Tapa",
  },
  {
    id: "ratonas",
    label: "Mesa",
    title: "Mesas ratonas y de luz",
    controls: [
      { key: "kind", type: "choice", label: "Tipo", options: choice(["ratona", "Ratona"], ["luz", "Mesa de luz"]) },
      { key: "width", type: "size", label: "Ancho", min: 350, max: 1400 },
      { key: "depth", type: "size", label: "Profundidad", min: 300, max: 800 },
      { key: "height", type: "size", label: "Alto", min: 300, max: 700 },
      { key: "drawers", type: "count", label: "Cajones", min: 0, max: 3 },
    ],
    defaults: { kind: "ratona", width: 1000, depth: 550, height: 380, drawers: 1 },
    body: "nogal",
    front: "nogal",
    bodyLabel: "Cuerpo",
    frontLabel: "Tapa y frentes",
  },
  {
    id: "tv",
    label: "Mueble de TV",
    title: "Muebles para televisión",
    controls: [
      { key: "width", type: "size", label: "Largo", min: 1000, max: 2500 },
      { key: "height", type: "size", label: "Alto", min: 350, max: 650 },
      { key: "depth", type: "size", label: "Profundidad", min: 320, max: 550 },
      { key: "fronts", type: "choice", label: "Frentes", options: choice(["mixto", "Puertas y cajones"], ["puertas", "Puertas"], ["cajones", "Cajones"], ["abierto", "Con nichos"]) },
      { key: "floating", type: "toggle", label: "Flotante", hint: "Colgado de la pared, sin patas" },
    ],
    defaults: { width: 1800, height: 450, depth: 420, fronts: "mixto", floating: false },
    body: "blanco",
    front: "roble",
    bodyLabel: "Cuerpo",
    frontLabel: "Frentes",
  },
  {
    id: "bibliotecas",
    label: "Biblioteca",
    title: "Bibliotecas y estanterías",
    controls: [
      { key: "width", type: "size", label: "Ancho", min: 500, max: 3200 },
      { key: "height", type: "size", label: "Alto", min: 900, max: 2500 },
      { key: "depth", type: "size", label: "Profundidad", min: 220, max: 450 },
      { key: "shelves", type: "count", label: "Estantes por columna", min: 2, max: 7 },
      { key: "back", type: "toggle", label: "Con fondo" },
      { key: "doors", type: "toggle", label: "Puertas abajo", hint: "Cierra el tramo de abajo" },
    ],
    defaults: { width: 1800, height: 2000, depth: 300, shelves: 4, back: true, doors: true },
    body: "roble",
    front: "grafito",
    bodyLabel: "Cuerpo",
    frontLabel: "Puertas",
  },
  {
    id: "sillones",
    label: "Sillón",
    title: "Sillones modulares",
    controls: [
      { key: "seats", type: "count", label: "Cuerpos", min: 1, max: 5 },
      { key: "seatWidth", type: "size", label: "Ancho de cada cuerpo", min: 700, max: 1100 },
      { key: "depth", type: "size", label: "Profundidad", min: 850, max: 1100 },
      { key: "chaise", type: "choice", label: "Chaise", options: choice(["no", "Sin chaise"], ["izquierda", "A la izquierda"], ["derecha", "A la derecha"]) },
      { key: "arms", type: "toggle", label: "Con apoyabrazos" },
    ],
    defaults: { seats: 3, seatWidth: 850, depth: 950, chaise: "derecha", arms: true },
    body: "nogal",
    front: "nogal",
    bodyLabel: "Patas",
    frontLabel: null,
    upholstered: true,
  },
];

export const specById = (id: string): FurnitureSpec | undefined => SPECS.find((s) => s.id === id);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function defaultFurniture(family: string): FurnitureConfig {
  const spec = specById(family) ?? SPECS[0];
  return { family: spec.id, values: { ...spec.defaults }, body: spec.body, front: spec.front, fabric: FABRICS[0].id };
}

/** deja cualquier configuración dentro de lo que la familia admite: un enlace viejo o editado a mano no rompe nada */
export function normalizeFurniture(input: unknown): FurnitureConfig {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Partial<FurnitureConfig>;
  const spec = specById(String(raw.family)) ?? SPECS[0];
  const src = (typeof raw.values === "object" && raw.values !== null ? raw.values : {}) as Record<string, unknown>;
  const values: Record<string, Value> = {};
  for (const c of spec.controls) {
    const fallback = spec.defaults[c.key];
    const v = Object.hasOwn(src, c.key) ? src[c.key] : fallback;
    if (c.type === "size" || c.type === "count") {
      const n = Number(v);
      const safe = Number.isFinite(n) ? clamp(n, c.min, c.max) : (fallback as number);
      values[c.key] = c.type === "size" ? Math.round(safe / 10) * 10 : Math.round(safe);
    } else if (c.type === "choice") values[c.key] = c.options.some((o) => o.id === v) ? (v as string) : fallback;
    else values[c.key] = v === true;
  }
  const material = (id: unknown, fallback: string) => (catalog.materials.some((m) => m.id === id) ? (id as string) : fallback);
  return {
    family: spec.id,
    values,
    body: material(raw.body, catalog.materials.some((m) => m.id === spec.body) ? spec.body : catalog.materials[0].id),
    front: material(raw.front, catalog.materials.some((m) => m.id === spec.front) ? spec.front : catalog.materials[0].id),
    fabric: FABRICS.some((f) => f.id === raw.fabric) ? (raw.fabric as string) : FABRICS[0].id,
  };
}

// ------------------------------------------------------------------ armado

const T = 18;

type Extra = Partial<Pick<Part, "front" | "hinge" | "openShift" | "details" | "geometry" | "module">> & { noCut?: boolean; band?: Cut["band"] };

/** una pieza: caja en el espacio y, si sale de placa, su medida de corte */
function piece(list: Part[], id: string, label: string, kind: PartKind, material: string, position: Vec3, size: Vec3, extra: Extra = {}): Part {
  const sorted = [...size].sort((a, b) => b - a);
  const board = !extra.noCut && Math.min(...size) <= 40 && !["metal", "fabric", "handle"].includes(material);
  const center = position.map((p, i) => p + size[i] / 2);
  const part: Part = {
    id,
    label,
    kind,
    material,
    run: 0,
    module: extra.module ?? null,
    position,
    size,
    geometry: extra.geometry ?? "box",
    cut: board ? { length: Math.round(sorted[0]), width: Math.round(sorted[1]), thickness: Math.round(sorted[2]), band: extra.band ?? { long: 1, short: 0 } } : null,
    // al separar las piezas, cada una se aleja del centro del mueble
    explode: [center[0] * 0.0, center[1] * 0.35, kind === "back" ? -220 : extra.front ? 260 : 0],
    front: extra.front,
    hinge: extra.hinge,
    openShift: extra.openShift,
    details: extra.details,
  };
  list.push(part);
  return part;
}

const handle = (id: string, x: number, y: number, w: number, vertical = false): Part => ({
  id,
  label: "Tirador",
  kind: "handle",
  material: "handle",
  run: 0,
  module: null,
  // sobre la cara de adelante del frente
  position: [x, y, T],
  size: vertical ? [10, w, 26] : [w, 10, 26],
  geometry: "box",
  cut: null,
  explode: [0, 0, 0],
});

/** un cajón completo: frente con tirador y caja, que sale hacia adelante al abrir */
function drawer(list: Part[], id: string, module: number, x: number, y: number, z: number, w: number, h: number, depth: number, material: string) {
  const out: Vec3 = [0, 0, Math.min(depth - 60, 380)];
  piece(list, `${id}:f`, "Frente de cajón", "drawer-front", material, [x, y, z], [w, h, T], {
    front: true,
    module,
    openShift: out,
    band: { long: 2, short: 2 },
    details: [handle(`${id}:h`, w / 2 - Math.min(80, w / 4), h / 2 - 5, Math.min(160, w / 2))],
  });
  const boxW = w - 50;
  const boxD = depth - 60;
  for (const [suffix, dx] of [["l", 25], ["r", 25 + boxW - 12]] as const) {
    piece(list, `${id}:${suffix}`, "Lateral de cajón", "drawer-side", "back", [x + dx, y + 12, z - boxD], [12, h - 40, boxD], { module, openShift: out, noCut: true });
  }
  piece(list, `${id}:b`, "Fondo de cajón", "drawer-bottom", "back", [x + 25, y + 12, z - boxD], [boxW, 4, boxD], { module, openShift: out, noCut: true });
}

function door(list: Part[], id: string, x: number, y: number, z: number, w: number, h: number, material: string, hinge: "left" | "right") {
  piece(list, id, "Puerta", "door", material, [x, y, z], [w, h, T], {
    front: true,
    hinge,
    band: { long: 2, short: 2 },
    details: [handle(`${id}:h`, hinge === "left" ? w - 45 : 35, Math.max(20, h / 2 - 60), Math.min(120, h - 40), true)],
  });
}

function legs(list: Part[], prefix: string, w: number, d: number, h: number, material: string, size = 45, inset = 40) {
  for (const [i, [x, z]] of [
    [inset, inset],
    [w - inset - size, inset],
    [inset, d - inset - size],
    [w - inset - size, d - inset - size],
  ].entries()) {
    piece(list, `${prefix}:${i}`, "Pata", "plinth", material, [x, 0, z], [size, h, size], { noCut: true });
  }
}

type Builder = (v: Record<string, Value>, c: FurnitureConfig) => { parts: Part[]; drawers: number; doors: number };

const BUILDERS: Record<string, Builder> = {
  mesas(v, c) {
    const w = v.width as number;
    const d = v.depth as number;
    const h = v.height as number;
    const parts: Part[] = [];
    const top = 30;
    piece(parts, "top", "Tapa", "top", c.front, [0, h - top, 0], [w, top, d], { front: false, band: { long: 2, short: 2 } });
    if (v.legs === "panel") {
      for (const [id, x] of [["l", 60], ["r", w - 60 - 36]] as const) piece(parts, `side:${id}`, "Lateral", "side", c.body, [x, 0, 40], [36, h - top, d - 80], { band: { long: 2, short: 1 } });
      piece(parts, "rail", "Travesaño", "divider", c.body, [96, h - top - 260, d / 2 - 9], [w - 192, 220, T]);
    } else {
      const metal = v.legs === "metal";
      legs(parts, "leg", w, d, h - top, metal ? "metal" : c.body, metal ? 30 : 60, metal ? 50 : 60);
      const inset = metal ? 50 : 60;
      const s = metal ? 30 : 60;
      // faldón: une las patas bajo la tapa
      for (const [id, z] of [["f", d - inset - s / 2 - 9], ["b", inset + s / 2 - 9]] as const) piece(parts, `apron:${id}`, "Faldón", "divider", metal ? "metal" : c.body, [inset + s, h - top - 90, z], [w - 2 * (inset + s), 80, T], { noCut: metal });
    }
    let drawers = 0;
    if (v.drawers) {
      const bw = 420;
      const x = w - 110 - bw;
      const bh = Math.min(520, h - top - 120);
      const y = h - top - bh;
      const z0 = 90;
      const bd = d - 150;
      piece(parts, "box:l", "Lateral de cajonera", "side", c.body, [x, y, z0], [T, bh, bd]);
      piece(parts, "box:r", "Lateral de cajonera", "side", c.body, [x + bw - T, y, z0], [T, bh, bd]);
      piece(parts, "box:b", "Piso de cajonera", "bottom", c.body, [x + T, y, z0], [bw - 2 * T, T, bd]);
      const n = 3;
      const fh = (bh - T - 4 * (n + 1)) / n;
      for (let i = 0; i < n; i++) drawer(parts, `dr${i}`, 0, x + T + 3, y + T + 4 + i * (fh + 4), z0 + bd, bw - 2 * T - 6, fh, bd, c.body);
      drawers = n;
    }
    return { parts, drawers, doors: 0 };
  },

  ratonas(v, c) {
    const w = v.width as number;
    const d = v.depth as number;
    const h = v.height as number;
    const n = v.drawers as number;
    const parts: Part[] = [];
    const leg = v.kind === "luz" ? 120 : 140;
    piece(parts, "top", "Tapa", "top", c.front, [0, h - T, 0], [w, T, d], { band: { long: 2, short: 2 } });
    piece(parts, "bottom", "Piso", "bottom", c.body, [T, leg, 0], [w - 2 * T, T, d - T]);
    piece(parts, "side:l", "Lateral", "side", c.body, [0, leg, 0], [T, h - T - leg, d]);
    piece(parts, "side:r", "Lateral", "side", c.body, [w - T, leg, 0], [T, h - T - leg, d]);
    piece(parts, "back", "Fondo", "back", "back", [T, leg + T, 0], [w - 2 * T, h - leg - 2 * T, 3], { noCut: true });
    legs(parts, "leg", w, d, leg, c.body, 36, 30);
    const inner = h - T - leg - T;
    const count = Math.min(n, Math.max(0, Math.floor(inner / 110)));
    if (count > 0) {
      const fh = (inner - 4 * (count + 1)) / count;
      for (let i = 0; i < count; i++) drawer(parts, `dr${i}`, 0, T + 3, leg + T + 4 + i * (fh + 4), d - T, w - 2 * T - 6, fh, d - T, c.front);
    }
    return { parts, drawers: count, doors: 0 };
  },

  tv(v, c) {
    const w = v.width as number;
    const h = v.height as number;
    const d = v.depth as number;
    const parts: Part[] = [];
    const base = v.floating ? 260 : 130;
    const modules = Math.max(2, Math.round(w / 600));
    const mw = (w - T) / modules;
    piece(parts, "top", "Tapa", "top", c.body, [0, base + h - T, 0], [w, T, d], { band: { long: 2, short: 2 } });
    piece(parts, "bottom", "Piso", "bottom", c.body, [0, base, 0], [w, T, d], { band: { long: 1, short: 2 } });
    for (let i = 0; i <= modules; i++) piece(parts, `div:${i}`, i === 0 || i === modules ? "Lateral" : "Divisor", i === 0 || i === modules ? "side" : "divider", c.body, [i * mw, base + T, 0], [T, h - 2 * T, d - (i === 0 || i === modules ? 0 : T)]);
    piece(parts, "back", "Fondo", "back", "back", [T, base + T, 0], [w - 2 * T, h - 2 * T, 3], { noCut: true });
    if (!v.floating) legs(parts, "leg", w, d, base, c.body, 40, 60);
    let drawers = 0;
    let doors = 0;
    const inner = h - 2 * T;
    for (let i = 0; i < modules; i++) {
      const x = i * mw + T + 3;
      const fw = mw - T - 6;
      const kind = v.fronts === "mixto" ? ["puertas", "cajones", "abierto"][i % 3] : (v.fronts as string);
      if (kind === "puertas") {
        door(parts, `door:${i}`, x, base + T + 3, d - T, fw, inner - 6, c.front, i % 2 ? "right" : "left");
        doors++;
      } else if (kind === "cajones") {
        const n = inner > 380 ? 2 : 1;
        const fh = (inner - 4 * (n + 1)) / n;
        for (let k = 0; k < n; k++) drawer(parts, `dr${i}:${k}`, i, x, base + T + 4 + k * (fh + 4), d - T, fw, fh, d - T, c.front);
        drawers += n;
      } else piece(parts, `shelf:${i}`, "Estante", "shelf", c.body, [i * mw + T, base + T + inner / 2, 0], [mw - T, T, d - 30]);
    }
    return { parts, drawers, doors };
  },

  bibliotecas(v, c) {
    const w = v.width as number;
    const h = v.height as number;
    const d = v.depth as number;
    const n = v.shelves as number;
    const parts: Part[] = [];
    const plinth = 80;
    const columns = Math.max(1, Math.ceil((w - T) / 820));
    const cw = (w - T) / columns;
    for (let i = 0; i <= columns; i++) piece(parts, `side:${i}`, i === 0 || i === columns ? "Lateral" : "Divisor", i === 0 || i === columns ? "side" : "divider", c.body, [i * cw, 0, 0], [T, h, d], { band: { long: 1, short: 0 } });
    if (v.back) piece(parts, "back", "Fondo", "back", "back", [T, plinth, 0], [w - 2 * T, h - plinth, 3], { noCut: true });
    const doorH = v.doors ? Math.min(760, Math.round(h * 0.36)) : 0;
    let doors = 0;
    for (let i = 0; i < columns; i++) {
      const x = i * cw + T;
      const sw = cw - T;
      piece(parts, `plinth:${i}`, "Zócalo", "plinth", c.body, [x, 0, d - 60], [sw, plinth, T]);
      piece(parts, `bottom:${i}`, "Piso", "bottom", c.body, [x, plinth, 0], [sw, T, d]);
      piece(parts, `top:${i}`, "Techo", "top", c.body, [x, h - T, 0], [sw, T, d]);
      const from = plinth + T;
      const free = h - T - from;
      for (let k = 1; k <= n; k++) {
        // con puertas, un estante queda justo a la altura donde terminan
        const y = v.doors && k === 1 ? from + doorH : from + (free * k) / (n + 1);
        if (v.doors && k > 1 && y < from + doorH + 120) continue;
        piece(parts, `shelf:${i}:${k}`, "Estante", "shelf", c.body, [x, y, 0], [sw, T, d - 20]);
      }
      if (v.doors) {
        const half = sw > 520 ? 2 : 1;
        const dw = (sw - 3 * (half + 1)) / half;
        for (let k = 0; k < half; k++) {
          door(parts, `door:${i}:${k}`, x + 3 + k * (dw + 3), from + 2, d - T, dw, doorH - 4, c.front, half === 1 ? "left" : k === 0 ? "left" : "right");
          doors++;
        }
      }
    }
    return { parts, drawers: 0, doors };
  },

  sillones(v, c) {
    const seats = v.seats as number;
    const sw = v.seatWidth as number;
    const d = v.depth as number;
    const parts: Part[] = [];
    const arm = v.arms ? 180 : 0;
    const base = 120;
    const seatH = 300;
    const back = 220;
    const w = seats * sw + 2 * arm;
    const soft = { geometry: "soft" as const, noCut: true };
    for (let i = 0; i < seats; i++) {
      const x = arm + i * sw;
      const chaise = (v.chaise === "izquierda" && i === 0) || (v.chaise === "derecha" && i === seats - 1);
      const depth = chaise ? d + 600 : d;
      piece(parts, `base:${i}`, "Base del módulo", "bottom", "fabric", [x, base, 0], [sw, 160, depth], soft);
      piece(parts, `seat:${i}`, "Almohadón de asiento", "shelf", "fabric", [x + 8, base + 150, back - 20], [sw - 16, seatH - 150, depth - back + 20], soft);
      piece(parts, `backrest:${i}`, "Respaldo", "back", "fabric", [x, base, 0], [sw, 640, back], soft);
      piece(parts, `pillow:${i}`, "Almohadón de respaldo", "fixed-shelf", "fabric", [x + 14, base + seatH - 10, back - 30], [sw - 28, 400, 190], soft);
    }
    if (v.arms) {
      const leftDeep = v.chaise === "izquierda" ? d + 600 : d;
      const rightDeep = v.chaise === "derecha" ? d + 600 : d;
      piece(parts, "arm:l", "Apoyabrazos", "side", "fabric", [0, base, 0], [arm, 480, leftDeep], soft);
      piece(parts, "arm:r", "Apoyabrazos", "side", "fabric", [w - arm, base, 0], [arm, 480, rightDeep], soft);
    }
    const n = seats + 1;
    for (let i = 0; i < n; i++) {
      const x = clamp((w * i) / (n - 1) - 30, 30, w - 90);
      for (const [k, z] of [60, d - 120].entries()) piece(parts, `leg:${i}:${k}`, "Pata", "plinth", c.body, [x, 0, z], [60, base, 60], { noCut: true });
    }
    return { parts, drawers: 0, doors: 0 };
  },
};

export type FurnitureBuild = { assembly: Assembly; parts: Part[]; doors: number; drawers: number };

export function buildFurniture(config: FurnitureConfig): FurnitureBuild {
  const { parts, drawers, doors } = BUILDERS[config.family](config.values, config);
  const min: Vec3 = [Infinity, 0, Infinity];
  const max: Vec3 = [-Infinity, 0, -Infinity];
  for (const p of parts) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p.position[k]);
      max[k] = Math.max(max[k], p.position[k] + p.size[k]);
    }
  }
  min[1] = 0;
  const assembly: Assembly = {
    runs: [{ index: 0, rotationY: 0, offset: [0, 0, 0], span: max[0] - min[0], parts }],
    hardware: [],
    counts: { modules: 1, doors, drawers, angledCuts: 0, curvedCuts: 0 },
    ledMeters: 0,
    bounds: { min, max },
  };
  return { assembly, parts, doors, drawers };
}

// ------------------------------------------------------------------ precio y resumen

/** valores de muestra de lo que no sale de placa; como todo precio de la demo, hay que reemplazarlos */
const SAMPLE = { sofaModule: 520_000, sofaArm: 140_000, sofaChaise: 260_000, leg: 9_000, metalLeg: 22_000 };

/**
 * Precio estimado, con valores de muestra: la placa que consume cada pieza
 * (con un 25 % de desperdicio), herrajes, armado y el margen del catálogo.
 */
export function furniturePrice(config: FurnitureConfig, build: FurnitureBuild = buildFurniture(config)): number {
  const boardArea = (catalog.board.length * catalog.board.width) / 1e6;
  let cost = 0;
  for (const p of build.parts) {
    if (p.cut) {
      const id = p.front ? config.front : p.material === "back" ? null : p.material;
      const price = id ? materialById(id).boardPrice : catalog.backBoard.price;
      const area = (p.cut.length * p.cut.width) / 1e6;
      cost += (area / boardArea) * price * 1.25 + ((p.cut.band.long * p.cut.length + p.cut.band.short * p.cut.width) / 1000) * catalog.edgeBandPerMeter;
    } else if (p.label === "Pata") cost += p.material === "metal" ? SAMPLE.metalLeg : SAMPLE.leg;
  }
  cost += build.doors * (2 * catalog.hardware.hinge + catalog.hardware.handle.bar + catalog.labor.perDoor);
  cost += build.drawers * (catalog.hardware.slidePair + catalog.hardware.handle.bar + catalog.labor.perDrawer);
  cost += catalog.labor.perModule + catalog.hardware.fittingsPerModule;
  if (config.family === "sillones") {
    const v = config.values;
    cost += (v.seats as number) * SAMPLE.sofaModule + (v.arms ? 2 * SAMPLE.sofaArm : 0) + (v.chaise !== "no" ? SAMPLE.sofaChaise : 0);
  }
  return Math.ceil((cost * (1 + catalog.margin)) / 1000) * 1000;
}

const cm = (mm: number) => Math.round(mm / 10);

export function furnitureSummary(config: FurnitureConfig, build: FurnitureBuild = buildFurniture(config)): DesignSummary {
  const spec = specById(config.family)!;
  const { min, max } = build.assembly.bounds;
  const lines: string[] = [];
  for (const c of spec.controls) {
    const v = config.values[c.key];
    if (c.type === "choice") lines.push(`${c.label}: ${c.options.find((o) => o.id === v)?.label.toLowerCase()}`);
    else if (c.type === "count") lines.push(`${c.label}: ${v}`);
    else if (c.type === "toggle" && v) lines.push(c.label);
  }
  if (spec.upholstered) lines.push(`Tapizado ${fabricById(config.fabric).name.toLowerCase()}`, `Patas ${materialById(config.body).name.toLowerCase()}`);
  else lines.push(spec.frontLabel ? `${spec.bodyLabel} ${materialById(config.body).name.toLowerCase()} · ${spec.frontLabel.toLowerCase()} ${materialById(config.front).name.toLowerCase()}` : materialById(config.body).name);
  return { dimensions: `${cm(max[0] - min[0])} × ${cm(max[1])} × ${cm(max[2] - min[2])} cm`, lines };
}
