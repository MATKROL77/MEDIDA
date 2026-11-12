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
  { id: "arena", name: "Lino arena", color: "#c9bba4" },
  { id: "crudo", name: "Bouclé crudo", color: "#e4ddd0" },
  { id: "gris", name: "Gris piedra", color: "#8e8f8c" },
  { id: "grafito", name: "Grafito", color: "#45474a" },
  { id: "ocre", name: "Pana ocre", color: "#b9731f" },
  { id: "bordo", name: "Pana bordó", color: "#6e1f24" },
  { id: "botella", name: "Verde botella", color: "#1f4a37" },
  { id: "azul", name: "Azul noche", color: "#2f3d55" },
] as const;

export const fabricById = (id: string) => FABRICS.find((f) => f.id === id) ?? FABRICS[0];

const choice = (...pairs: [string, string][]) => pairs.map(([id, label]) => ({ id, label }));
const LED: Control = { key: "led", type: "toggle", label: "Luz LED", hint: "Tira de luz cálida" };

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
      { key: "top", type: "choice", label: "Tapa", options: choice(["recta", "Recta"], ["redonda", "Redondeada"], ["vidrio", "De vidrio"]) },
      { key: "legs", type: "choice", label: "Base", options: choice(["madera", "Patas rectas"], ["conicas", "Patas cónicas"], ["hierro", "Pórticos de hierro"], ["panel", "Laterales llenos"], ["pedestal", "Con cajonera"]) },
      LED,
    ],
    defaults: { width: 2000, depth: 950, height: 750, top: "redonda", legs: "conicas", led: false },
    body: "nogal",
    front: "nogal",
    bodyLabel: "Base",
    frontLabel: "Tapa",
  },
  {
    id: "ratonas",
    label: "Mesa",
    title: "Mesas ratonas y de luz",
    controls: [
      { key: "kind", type: "choice", label: "Tipo", options: choice(["ratona", "Ratona"], ["luz", "Mesa de luz"]) },
      { key: "style", type: "choice", label: "Estilo", options: choice(["clasica", "Con cajones"], ["puente", "Puente"], ["losa", "Losa"], ["vidrio", "Tapa de vidrio"]) },
      { key: "width", type: "size", label: "Ancho", min: 350, max: 1400 },
      { key: "depth", type: "size", label: "Profundidad", min: 300, max: 800 },
      { key: "height", type: "size", label: "Alto", min: 280, max: 700 },
      { key: "drawers", type: "count", label: "Cajones", min: 0, max: 3 },
      { key: "floating", type: "toggle", label: "Flotante", hint: "La mesa de luz con cajones, colgada de la pared" },
      LED,
    ],
    defaults: { kind: "ratona", style: "puente", width: 1200, depth: 600, height: 360, drawers: 0, floating: false, led: false },
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
      { key: "fronts", type: "choice", label: "Frentes", options: choice(["mixto", "Combinado"], ["puertas", "Puertas"], ["cajones", "Cajones"], ["vidrio", "Vidrio"], ["abierto", "Nichos"]) },
      { key: "base", type: "choice", label: "Apoyo", options: choice(["patas", "Patas cónicas"], ["hierro", "Marco de hierro"], ["flotante", "Flotante"]) },
      LED,
    ],
    defaults: { width: 2000, height: 450, depth: 420, fronts: "mixto", base: "flotante", led: true },
    body: "nogal",
    front: "nogal",
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
      { key: "structure", type: "choice", label: "Estructura", options: choice(["madera", "De madera"], ["hierro", "De hierro"]) },
      { key: "doors", type: "choice", label: "Puertas", options: choice(["no", "Sin puertas"], ["madera", "Abajo, de madera"], ["vidrio", "Enteras, de vidrio"]) },
      { key: "back", type: "toggle", label: "Con fondo" },
      LED,
    ],
    defaults: { width: 1800, height: 2100, depth: 320, shelves: 4, structure: "madera", doors: "madera", back: true, led: false },
    body: "nogal",
    front: "nogal",
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
      { key: "style", type: "choice", label: "Estilo", options: choice(["clasico", "Recto"], ["puff", "Puff"]) },
      { key: "base", type: "choice", label: "Apoyo", options: choice(["piso", "Al piso"], ["patas", "Con patas"]) },
      { key: "chaise", type: "choice", label: "Chaise", options: choice(["no", "Sin chaise"], ["izquierda", "A la izquierda"], ["derecha", "A la derecha"]) },
      { key: "arms", type: "toggle", label: "Con apoyabrazos" },
    ],
    defaults: { seats: 3, seatWidth: 850, depth: 950, style: "clasico", base: "piso", chaise: "derecha", arms: true },
    body: "nogal",
    front: "nogal",
    bodyLabel: "Zócalo o patas",
    frontLabel: null,
    upholstered: true,
  },
];

export const hasLed = (config: FurnitureConfig): boolean => config.values.led === true;

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
/** a qué distancia de la pared queda lo que va en el medio del ambiente */
const ROOM_CENTER = 1900;
const NOT_BOARD = ["metal", "iron", "fabric", "handle", "glass", "led", "glow", "back"];

type Extra = Partial<Pick<Part, "front" | "hinge" | "openShift" | "details" | "geometry" | "module" | "decor" | "glow">> & { noCut?: boolean; band?: Cut["band"] };

/** una pieza: caja en el espacio y, si sale de placa, su medida de corte */
function piece(list: Part[], id: string, label: string, kind: PartKind, material: string, position: Vec3, size: Vec3, extra: Extra = {}): Part {
  const sorted = [...size].sort((a, b) => b - a);
  const flat = !extra.geometry || extra.geometry === "box" || extra.geometry === "soft";
  const board = !extra.noCut && !extra.decor && flat && Math.min(...size) <= 60 && !NOT_BOARD.includes(material) && !material.includes(":");
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
    glow: extra.glow,
    decor: extra.decor,
    cut: board ? { length: Math.round(sorted[0]), width: Math.round(sorted[1]), thickness: Math.round(sorted[2]), band: extra.band ?? { long: 1, short: 0 } } : null,
    // al separar las piezas, la ambientación se queda en su lugar
    explode: extra.decor ? [0, 0, 0] : [0, (position[1] + size[1] / 2) * 0.35, kind === "back" ? -220 : extra.front ? 260 : 0],
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
  size: vertical ? [10, w, 22] : [w, 10, 22],
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
    details: [handle(`${id}:h`, w / 2 - Math.min(70, w / 4), h - 26, Math.min(140, w / 2))],
  });
  const boxW = w - 50;
  const boxD = depth - 60;
  for (const [suffix, dx] of [["l", 25], ["r", 25 + boxW - 12]] as const) {
    piece(list, `${id}:${suffix}`, "Lateral de cajón", "drawer-side", "back", [x + dx, y + 12, z - boxD], [12, h - 40, boxD], { module, openShift: out });
  }
  piece(list, `${id}:b`, "Fondo de cajón", "drawer-bottom", "back", [x + 25, y + 12, z - boxD], [boxW, 4, boxD], { module, openShift: out });
}

function door(list: Part[], id: string, x: number, y: number, z: number, w: number, h: number, material: string, hinge: "left" | "right") {
  const glass = material === "glass";
  piece(list, id, glass ? "Puerta de vidrio" : "Puerta", "door", material, [x, y, z], [w, h, glass ? 8 : T], {
    front: true,
    hinge,
    band: { long: 2, short: 2 },
    details: [handle(`${id}:h`, hinge === "left" ? w - 40 : 30, Math.max(20, h / 2 - 60), Math.min(120, h - 40), true)],
  });
}

/** cuatro patas en las esquinas de un rectángulo, metidas `inset` desde cada borde */
function legs(list: Part[], prefix: string, x0: number, z0: number, w: number, d: number, h: number, kind: "recta" | "conica" | "hierro", material: string, inset: number) {
  const s = kind === "hierro" ? 28 : kind === "conica" ? 58 : 64;
  for (const [i, [x, z]] of [
    [x0 + inset, z0 + inset],
    [x0 + w - inset - s, z0 + inset],
    [x0 + inset, z0 + d - inset - s],
    [x0 + w - inset - s, z0 + d - inset - s],
  ].entries()) {
    piece(list, `${prefix}:${i}`, "Pata", "plinth", kind === "hierro" ? "iron" : material, [x, 0, z], [s, h, s], { geometry: kind === "conica" ? "cone" : "box", noCut: true });
  }
}

/** tira LED: una línea de luz y, opcional, su resplandor sobre el piso */
function led(list: Part[], id: string, x: number, y: number, z: number, length: number, pool?: { y: number; depth: number }) {
  piece(list, id, "Tira LED", "led", "led", [x, y, z], [length, 6, 10], { noCut: true });
  if (pool) piece(list, `${id}:g`, "Luz", "glow", "glow", [x - 60, pool.y, z - pool.depth / 2], [length + 120, 2, pool.depth], { geometry: "glow", glow: "y", noCut: true });
}

// ---- ambientación: lo que rodea al mueble para verlo en un lugar de verdad

const deco = { decor: true, noCut: true } as const;
const BOOKS = ["#7b2f2a", "#e8e1d2", "#2f3b4a", "#b98b3e", "#d8d2c6", "#3d4a3a", "#8a8a86", "#c9b79c"];

function rug(list: Part[], x: number, z: number, w: number, d: number, color = "#b9ad9b") {
  piece(list, "deco:rug", "Alfombra", "bottom", `tint:${color}`, [x, 0, z], [w, 12, d], { ...deco, geometry: "soft" });
}
/** libros parados, uno al lado del otro */
function books(list: Part[], id: string, x: number, y: number, z: number, n: number, depth = 150) {
  let cx = x;
  for (let i = 0; i < n; i++) {
    const t = 24 + ((i * 7) % 4) * 6;
    const h = 190 + ((i * 5) % 4) * 14;
    piece(list, `${id}:${i}`, "Libro", "shelf", `tint:${BOOKS[(i * 3 + n) % BOOKS.length]}`, [cx, y, z], [t, h, depth], deco);
    cx += t + 1;
  }
}
/** dos libros acostados y un jarrón encima o al lado */
function tabletop(list: Part[], id: string, x: number, y: number, z: number) {
  piece(list, `${id}:b1`, "Libro", "shelf", "tint:#e8e1d2", [x, y, z], [250, 26, 180], deco);
  piece(list, `${id}:b2`, "Libro", "shelf", "tint:#2f3b4a", [x + 14, y + 26, z + 10], [220, 22, 160], deco);
  piece(list, `${id}:v`, "Jarrón", "shelf", "tint:#22201e", [x + 330, y, z + 30], [120, 190, 120], { ...deco, geometry: "puff" });
}
function lamp(list: Part[], id: string, x: number, y: number, z: number) {
  piece(list, `${id}:base`, "Lámpara", "shelf", "gloss:#b9a27c", [x, y, z], [110, 14, 110], { ...deco, geometry: "cyl" });
  piece(list, `${id}:stem`, "Lámpara", "shelf", "gloss:#b9a27c", [x + 48, y + 14, z + 48], [14, 230, 14], { ...deco, geometry: "cyl" });
  piece(list, `${id}:shade`, "Lámpara", "shelf", "tint:#efe7d8", [x - 35, y + 220, z - 35], [180, 120, 180], { ...deco, geometry: "cone" });
}

type Builder = (v: Record<string, Value>, c: FurnitureConfig) => { parts: Part[]; drawers: number; doors: number; center?: boolean; gap?: number };

const BUILDERS: Record<string, Builder> = {
  mesas(v, c) {
    const w = v.width as number;
    const d = v.depth as number;
    const h = v.height as number;
    const parts: Part[] = [];
    const glass = v.top === "vidrio";
    const top = glass ? 12 : 36;
    piece(parts, "top", glass ? "Tapa de vidrio" : "Tapa", glass ? "glass" : "top", glass ? "glass" : c.front, [0, h - top, 0], [w, top, d], { geometry: v.top === "redonda" ? "soft" : "box", band: { long: 2, short: 2 } });
    const under = h - top;
    let drawers = 0;
    if (v.legs === "panel" || v.legs === "pedestal") {
      const side = 40;
      piece(parts, "side:r", "Lateral", "side", c.body, [w - 90 - side, 0, 70], [side, under, d - 140], { band: { long: 2, short: 1 } });
      if (v.legs === "panel") {
        piece(parts, "side:l", "Lateral", "side", c.body, [90, 0, 70], [side, under, d - 140], { band: { long: 2, short: 1 } });
        piece(parts, "rail", "Travesaño", "divider", c.body, [90 + side, under - 300, d / 2 - 9], [w - 180 - 2 * side, 260, T]);
      } else {
        // la cajonera hace de pata: un cuerpo cerrado con tres cajones a un lado
        const bw = 460;
        const x = 90;
        const z0 = 70;
        const bd = d - 140;
        piece(parts, "box:l", "Lateral de cajonera", "side", c.body, [x, 0, z0], [T, under, bd]);
        piece(parts, "box:r", "Lateral de cajonera", "side", c.body, [x + bw - T, 0, z0], [T, under, bd]);
        piece(parts, "box:b", "Piso de cajonera", "bottom", c.body, [x + T, 60, z0], [bw - 2 * T, T, bd]);
        piece(parts, "box:k", "Fondo de cajonera", "back", "back", [x + T, 60, z0], [bw - 2 * T, under - 60, 3]);
        piece(parts, "box:z", "Zócalo", "plinth", c.body, [x + T, 0, z0 + bd - 50], [bw - 2 * T, 60, T]);
        const n = 3;
        const fh = (under - 60 - T - 4 * (n + 1)) / n;
        for (let i = 0; i < n; i++) drawer(parts, `dr${i}`, 0, x + T + 3, 60 + T + 4 + i * (fh + 4), z0 + bd, bw - 2 * T - 6, fh, bd, c.body);
        drawers = n;
        piece(parts, "rail", "Travesaño", "divider", c.body, [x + bw, under - 300, d / 2 - 9], [w - 180 - bw - side, 260, T]);
      }
    } else if (v.legs === "hierro") {
      // dos pórticos: patas, travesaño al piso y travesaño bajo la tapa
      for (const [id, x] of [["l", 140], ["r", w - 190]] as const) {
        for (const [k, z] of [80, d - 120].entries()) piece(parts, `frame:${id}:${k}`, "Pata", "plinth", "iron", [x, 0, z], [50, under, 40]);
        piece(parts, `frame:${id}:t`, "Travesaño de hierro", "divider", "iron", [x, under - 40, 120], [50, 40, d - 240], { noCut: true });
        piece(parts, `frame:${id}:b`, "Travesaño de hierro", "divider", "iron", [x, 0, 120], [50, 40, d - 240], { noCut: true });
      }
      piece(parts, "frame:bar", "Larguero de hierro", "divider", "iron", [190, under - 40, d / 2 - 20], [w - 380, 40, 40], { noCut: true });
    } else {
      const conic = v.legs === "conicas";
      const inset = conic ? 110 : 60;
      const s = conic ? 58 : 64;
      legs(parts, "leg", 0, 0, w, d, under, conic ? "conica" : "recta", c.body, inset);
      // faldón: une las patas bajo la tapa, por los cuatro lados
      const a = inset + s;
      for (const [id, z] of [["f", d - inset - s / 2 - 9], ["b", inset + s / 2 - 9]] as const) piece(parts, `apron:${id}`, "Faldón", "divider", c.body, [a, under - 90, z], [w - 2 * a, 80, T]);
      for (const [id, x] of [["l", inset + s / 2 - 9], ["r", w - inset - s / 2 - 9]] as const) piece(parts, `apron:${id}`, "Faldón", "divider", c.body, [x, under - 90, a], [T, 80, d - 2 * a]);
    }
    if (v.led) led(parts, "led", 120, under - 8, d - 150, w - 240, { y: 14, depth: d * 0.9 });
    rug(parts, -450, -450, w + 900, d + 900);
    tabletop(parts, "deco:top", w * 0.22, h, d * 0.36);
    lamp(parts, "deco:lamp", w - 330, h, d * 0.25);
    return { parts, drawers, doors: 0, center: true };
  },

  ratonas(v, c) {
    const w = v.width as number;
    const d = v.depth as number;
    const h = v.height as number;
    const n = v.drawers as number;
    const bedside = v.kind === "luz";
    const parts: Part[] = [];
    let drawers = 0;
    const floating = bedside && v.style === "clasica" && v.floating === true;
    const lift = floating ? 300 : 0;

    if (v.style === "puente") {
      // una pieza continua: tapa y dos laterales del mismo espesor, con un estante abajo
      const t = 36;
      piece(parts, "top", "Tapa", "top", c.front, [0, h - t, 0], [w, t, d], { geometry: "soft", band: { long: 2, short: 2 } });
      for (const [id, x] of [["l", 0], ["r", w - t]] as const) piece(parts, `side:${id}`, "Lateral", "side", c.front, [x, 0, 0], [t, h - t + 6, d], { geometry: "soft", band: { long: 2, short: 1 } });
      piece(parts, "shelf", "Estante", "shelf", c.body, [t, 60, 20], [w - 2 * t, T, d - 40]);
      if (n > 0 && h - t - 60 - T > 150) {
        const fh = Math.min(170, h - t - 60 - T - 30);
        piece(parts, "box:b", "Piso del cajón", "bottom", c.body, [t, h - t - fh - T - 6, 0], [w - 2 * t, T, d - T]);
        drawer(parts, "dr0", 0, t + 3, h - t - fh - 3, d - T, w - 2 * t - 6, fh, d - T, c.front);
        drawers = 1;
      }
      if (v.led) led(parts, "led", t + 30, h - t - 8, d - 60, w - 2 * t - 60);
    } else if (v.style === "losa") {
      // una losa gruesa apoyada en dos bases metidas hacia adentro
      const t = 60;
      piece(parts, "top", "Tapa", "top", c.front, [0, h - t, 0], [w, t, d], { band: { long: 2, short: 2 } });
      const bw = Math.max(80, Math.round(w * 0.1));
      for (const [id, x] of [["l", w * 0.16], ["r", w * 0.84 - bw]] as const) piece(parts, `base:${id}`, "Base", "plinth", c.body, [x, 0, d * 0.14], [bw, h - t, d * 0.72], { noCut: true });
      if (v.led) led(parts, "led", w * 0.16 + bw, h - t - 8, d * 0.5, w * 0.68 - 2 * bw, { y: 14, depth: d * 0.8 });
    } else if (v.style === "vidrio") {
      // marco de madera con la tapa de vidrio apoyada adentro y un estante abajo
      const s = 54;
      legs(parts, "leg", 0, 0, w, d, h, "recta", c.body, 0);
      for (const [id, z] of [["f", d - s], ["b", 0]] as const) piece(parts, `rail:${id}`, "Larguero", "divider", c.body, [s, h - s, z + (s - T) / 2], [w - 2 * s, s, T]);
      for (const [id, x] of [["l", 0], ["r", w - s]] as const) piece(parts, `rail:${id}`, "Travesaño", "divider", c.body, [x + (s - T) / 2, h - s, s], [T, s, d - 2 * s]);
      piece(parts, "glass", "Tapa de vidrio", "glass", "glass", [s - 8, h - 14, s - 8], [w - 2 * s + 16, 10, d - 2 * s + 16], { noCut: true });
      piece(parts, "shelf", "Estante", "shelf", c.front, [s / 2, 90, s / 2], [w - s, T, d - s]);
      if (v.led) led(parts, "led", s, h - s - 8, d - s - 20, w - 2 * s);
    } else {
      const leg = floating ? 0 : bedside ? 110 : 130;
      const y0 = lift + leg;
      piece(parts, "top", "Tapa", "top", c.front, [0, lift + h - T, 0], [w, T, d], { band: { long: 2, short: 2 } });
      piece(parts, "bottom", "Piso", "bottom", c.body, [T, y0, 0], [w - 2 * T, T, d - T]);
      piece(parts, "side:l", "Lateral", "side", c.body, [0, y0, 0], [T, h - T - leg, d]);
      piece(parts, "side:r", "Lateral", "side", c.body, [w - T, y0, 0], [T, h - T - leg, d]);
      piece(parts, "back", "Fondo", "back", "back", [T, y0 + T, 0], [w - 2 * T, h - leg - 2 * T, 3]);
      if (!floating) legs(parts, "leg", 0, 0, w, d, leg, "conica", c.body, 40);
      const inner = h - T - leg - T;
      const count = Math.min(n, Math.max(0, Math.floor(inner / 110)));
      if (count > 0) {
        const fh = (inner - 4 * (count + 1)) / count;
        for (let i = 0; i < count; i++) drawer(parts, `dr${i}`, 0, T + 3, y0 + T + 4 + i * (fh + 4), d - T, w - 2 * T - 6, fh, d - T, c.front);
      }
      drawers = count;
      if (v.led) led(parts, "led", 40, y0 - 8, d * 0.5, w - 80, { y: 4, depth: d * 1.3 });
    }

    const topY = lift + h;
    if (bedside) {
      // al lado de una cama, que es donde vive una mesa de luz
      const bx = w + 70;
      piece(parts, "deco:bed", "Cama", "bottom", "tint:#9c8f7e", [bx, 0, 0], [1500, 300, 2050], { ...deco, geometry: "soft" });
      piece(parts, "deco:mattress", "Colchón", "bottom", "tint:#efe9df", [bx + 20, 290, 60], [1460, 230, 1970], { ...deco, geometry: "soft" });
      piece(parts, "deco:head", "Respaldo", "back", "tint:#8a7d6c", [bx - 20, 0, 0], [1540, 1050, 70], { ...deco, geometry: "soft" });
      piece(parts, "deco:pillow", "Almohada", "shelf", "tint:#f6f2ea", [bx + 110, 500, 110], [640, 150, 420], { ...deco, geometry: "puff" });
      lamp(parts, "deco:lamp", w * 0.5 - 55, topY, d * 0.3);
      return { parts, drawers, doors: 0 };
    }
    rug(parts, -580, -560, w + 1160, d + 1120);
    tabletop(parts, "deco:top", w * 0.18, topY, d * 0.3);
    return { parts, drawers, doors: 0, center: true };
  },

  tv(v, c) {
    const w = v.width as number;
    const h = v.height as number;
    const d = v.depth as number;
    const parts: Part[] = [];
    const floating = v.base === "flotante";
    const base = floating ? 260 : v.base === "hierro" ? 200 : 150;
    const modules = Math.max(2, Math.round(w / 600));
    const mw = (w - T) / modules;
    piece(parts, "top", "Tapa", "top", c.front, [0, base + h - T, 0], [w, T, d], { band: { long: 2, short: 2 } });
    piece(parts, "bottom", "Piso", "bottom", c.body, [0, base, 0], [w, T, d], { band: { long: 1, short: 2 } });
    for (let i = 0; i <= modules; i++) {
      const end = i === 0 || i === modules;
      piece(parts, `div:${i}`, end ? "Lateral" : "Divisor", end ? "side" : "divider", c.body, [i * mw, base + T, 0], [T, h - 2 * T, d - (end ? 0 : T)]);
    }
    piece(parts, "back", "Fondo", "back", "back", [T, base + T, 0], [w - 2 * T, h - 2 * T, 3]);
    if (v.base === "patas") legs(parts, "leg", 0, 0, w, d, base, "conica", c.body, 90);
    if (v.base === "hierro") {
      legs(parts, "leg", 0, 0, w, d, base, "hierro", "iron", 70);
      for (const [id, z] of [["f", d - 98], ["b", 70]] as const) piece(parts, `bar:${id}`, "Larguero de hierro", "divider", "iron", [98, base - 28, z], [w - 196, 28, 28], { noCut: true });
    }
    let drawers = 0;
    let doors = 0;
    const inner = h - 2 * T;
    for (let i = 0; i < modules; i++) {
      const x = i * mw + T + 3;
      const fw = mw - T - 6;
      const kind = v.fronts === "mixto" ? ["puertas", "abierto", "cajones", "vidrio"][i % 4] : (v.fronts as string);
      if (kind === "puertas" || kind === "vidrio") {
        if (kind === "vidrio") piece(parts, `shelf:${i}`, "Estante", "shelf", c.body, [i * mw + T, base + T + inner / 2, 0], [mw - T, T, d - 50]);
        door(parts, `door:${i}`, x, base + T + 3, d - (kind === "vidrio" ? 8 : T), fw, inner - 6, kind === "vidrio" ? "glass" : c.front, i % 2 ? "right" : "left");
        doors++;
      } else if (kind === "cajones") {
        const n = inner > 380 ? 2 : 1;
        const fh = (inner - 4 * (n + 1)) / n;
        for (let k = 0; k < n; k++) drawer(parts, `dr${i}:${k}`, i, x, base + T + 4 + k * (fh + 4), d - T, fw, fh, d - T, c.front);
        drawers += n;
      } else {
        piece(parts, `shelf:${i}`, "Estante", "shelf", c.body, [i * mw + T, base + T + inner / 2, 0], [mw - T, T, d - 30]);
        // en un nicho abierto la luz va arriba, escondida detrás del canto
        if (v.led) led(parts, `led:n${i}`, i * mw + T + 20, base + h - T - 8, d - 50, mw - T - 40);
      }
    }
    if (v.led) led(parts, "led:under", 60, base - 8, d * 0.45, w - 120, { y: 4, depth: d * 1.5 });
    // la tele en la pared, y algo apoyado arriba
    const tw = Math.min(w * 0.72, 1650);
    piece(parts, "deco:tv", "Televisor", "back", "gloss:#0b0b0c", [(w - tw) / 2, base + h + 330, 20], [tw, tw * 0.57, 45], deco);
    tabletop(parts, "deco:top", w * 0.08, base + h, d * 0.25);
    return { parts, drawers, doors };
  },

  bibliotecas(v, c) {
    const w = v.width as number;
    const h = v.height as number;
    const d = v.depth as number;
    const n = v.shelves as number;
    const parts: Part[] = [];
    const iron = v.structure === "hierro";
    const columns = Math.max(1, Math.ceil((w - T) / 820));
    let doors = 0;

    if (iron) {
      // parantes de hierro adelante y atrás, con los estantes de madera pasando de lado a lado
      const s = 28;
      const cw = (w - s) / columns;
      for (let i = 0; i <= columns; i++) {
        for (const [k, z] of [0, d - s].entries()) piece(parts, `post:${i}:${k}`, "Parante de hierro", "side", "iron", [i * cw, 0, z], [s, h, s], { noCut: true });
        piece(parts, `tie:${i}`, "Travesaño de hierro", "divider", "iron", [i * cw, h - s, s], [s, s, d - 2 * s], { noCut: true });
      }
      const levels = n + 2;
      for (let k = 0; k < levels; k++) {
        const y = 120 + ((h - 120 - T) * k) / (levels - 1);
        for (let i = 0; i < columns; i++) {
          piece(parts, `shelf:${i}:${k}`, "Estante", "shelf", c.body, [i * cw + s, y, 0], [cw - s, T + 10, d], { band: { long: 2, short: 0 } });
          if (v.led && k > 0) led(parts, `led:${i}:${k}`, i * cw + s + 20, y - 8, d - 40, cw - s - 40);
          if (k < levels - 1 && (i + k) % 2 === 0) books(parts, `deco:b${i}:${k}`, i * cw + s + 30, y + T + 10, 40, 5 + ((i + k) % 3), Math.min(170, d - 60));
        }
      }
      if (v.back) piece(parts, "back", "Fondo", "back", "back", [s, 120, 0], [w - 2 * s, h - 120, 3]);
      return { parts, drawers: 0, doors };
    }

    const plinth = 80;
    const cw = (w - T) / columns;
    const glassDoors = v.doors === "vidrio";
    for (let i = 0; i <= columns; i++) {
      const end = i === 0 || i === columns;
      piece(parts, `side:${i}`, end ? "Lateral" : "Divisor", end ? "side" : "divider", c.body, [i * cw, 0, 0], [T, h, d - (glassDoors && !end ? 10 : 0)], { band: { long: 1, short: 0 } });
    }
    if (v.back) piece(parts, "back", "Fondo", "back", "back", [T, plinth, 0], [w - 2 * T, h - plinth, 3]);
    const doorH = v.doors === "madera" ? Math.min(760, Math.round(h * 0.36)) : 0;
    for (let i = 0; i < columns; i++) {
      const x = i * cw + T;
      const sw = cw - T;
      const inset = glassDoors ? 30 : 20;
      piece(parts, `plinth:${i}`, "Zócalo", "plinth", c.body, [x, 0, d - 60], [sw, plinth, T]);
      piece(parts, `bottom:${i}`, "Piso", "bottom", c.body, [x, plinth, 0], [sw, T, d - (glassDoors ? 10 : 0)]);
      piece(parts, `top:${i}`, "Techo", "top", c.body, [x, h - T, 0], [sw, T, d - (glassDoors ? 10 : 0)]);
      const from = plinth + T;
      const free = h - T - from;
      for (let k = 1; k <= n; k++) {
        // con puertas abajo, un estante queda justo a la altura donde terminan
        const y = doorH && k === 1 ? from + doorH : from + (free * k) / (n + 1);
        if (doorH && k > 1 && y < from + doorH + 120) continue;
        piece(parts, `shelf:${i}:${k}`, "Estante", "shelf", c.body, [x, y, 0], [sw, T, d - inset]);
        if (v.led) led(parts, `led:${i}:${k}`, x + 20, y - 8, d - inset - 30, sw - 40);
        if ((i + k) % 2 === 1 && y + 280 < h) books(parts, `deco:b${i}:${k}`, x + 30, y + T, 40, 4 + ((i + k) % 4), Math.min(170, d - 70));
      }
      const half = sw > 520 ? 2 : 1;
      const dw = (sw - 3 * (half + 1)) / half;
      if (doorH || glassDoors) {
        const dh = glassDoors ? h - from - T - 4 : doorH - 4;
        for (let k = 0; k < half; k++) {
          door(parts, `door:${i}:${k}`, x + 3 + k * (dw + 3), from + 2, d - (glassDoors ? 8 : T), dw, dh, glassDoors ? "glass" : c.front, half === 1 ? "left" : k === 0 ? "left" : "right");
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
    const puff = v.style === "puff";
    const onLegs = v.base === "patas";
    const lift = onLegs ? 130 : 50;
    const arm = v.arms ? (puff ? 0 : 180) : 0;
    const w = seats * sw + 2 * arm;
    const soft = { geometry: (puff ? "puff" : "soft") as "puff" | "soft", noCut: true };
    const deep = (i: number) => ((v.chaise === "izquierda" && i === 0) || (v.chaise === "derecha" && i === seats - 1) ? d + 620 : d);

    for (let i = 0; i < seats; i++) {
      const x = arm + i * sw;
      const depth = deep(i);
      if (puff) {
        // cada cuerpo es un almohadón grande, con un rollo de respaldo apoyado encima
        piece(parts, `seat:${i}`, "Almohadón de asiento", "shelf", "fabric", [x + 4, lift, 0], [sw - 8, 400, depth], soft);
        piece(parts, `backrest:${i}`, "Rollo de respaldo", "back", "fabric", [x + 30, lift + 330, 20], [sw - 60, 330, 330], soft);
      } else {
        piece(parts, `base:${i}`, "Base del módulo", "bottom", "fabric", [x, lift, 0], [sw, 190, depth], soft);
        piece(parts, `seat:${i}`, "Almohadón de asiento", "shelf", "fabric", [x + 6, lift + 170, 200], [sw - 12, 170, depth - 200], soft);
        piece(parts, `backrest:${i}`, "Respaldo", "back", "fabric", [x, lift, 0], [sw, 660, 220], soft);
        piece(parts, `pillow:${i}`, "Almohadón de respaldo", "fixed-shelf", "fabric", [x + 12, lift + 320, 190], [sw - 24, 400, 200], soft);
      }
    }
    if (v.arms) {
      if (puff) {
        for (const [id, i] of [["l", 0], ["r", seats - 1]] as const) {
          const x = id === "l" ? 20 : w - 300;
          piece(parts, `arm:${id}`, "Rollo apoyabrazos", "side", "fabric", [x, lift + 330, 330], [280, 300, deep(i) - 480], soft);
        }
      } else {
        piece(parts, "arm:l", "Apoyabrazos", "side", "fabric", [0, lift, 0], [arm, 520, deep(0)], soft);
        piece(parts, "arm:r", "Apoyabrazos", "side", "fabric", [w - arm, lift, 0], [arm, 520, deep(seats - 1)], soft);
      }
    }
    if (onLegs) {
      // patas bajo el cuerpo, metidas hacia adentro: no asoman por los costados ni por atrás
      const posts = Math.max(2, seats + 1);
      for (let i = 0; i < posts; i++) {
        const x = 90 + ((w - 240) * i) / (posts - 1);
        const depth = deep(Math.min(seats - 1, Math.max(0, Math.round((i * (seats - 1)) / (posts - 1)))));
        for (const [k, z] of [110, depth - 170].entries()) piece(parts, `leg:${i}:${k}`, "Pata", "plinth", c.body, [x, 0, z], [58, lift + 20, 58], { geometry: "cone", noCut: true });
      }
    } else {
      // al piso: un zócalo retranqueado, que casi no se ve
      for (let i = 0; i < seats; i++) piece(parts, `plinth:${i}`, "Zócalo", "plinth", c.body, [arm + i * sw + 50, 0, 60], [sw - 100, lift + 10, deep(i) - 130], { noCut: true });
    }
    rug(parts, -300, 250, w + 600, d + 1500);
    return { parts, drawers: 0, doors: 0, gap: 140 };
  },
};

export type FurnitureBuild = { assembly: Assembly; parts: Part[]; doors: number; drawers: number };

export function buildFurniture(config: FurnitureConfig): FurnitureBuild {
  const { parts, drawers, doors, center, gap } = BUILDERS[config.family](config.values, config);
  // lo que va en el medio del ambiente se separa de la pared; lo demás queda apoyado contra ella
  const shift = center ? ROOM_CENTER : (gap ?? 0);
  if (shift) for (const p of parts) p.position = [p.position[0], p.position[1], p.position[2] + shift];
  const min: Vec3 = [Infinity, 0, Infinity];
  const max: Vec3 = [-Infinity, 0, -Infinity];
  // las medidas son las del mueble: la alfombra o la tele no cuentan
  for (const p of parts) {
    if (p.decor || p.kind === "glow") continue;
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p.position[k]);
      max[k] = Math.max(max[k], p.position[k] + p.size[k]);
    }
  }
  min[1] = 0;
  const own = parts.filter((p) => !p.decor);
  const assembly: Assembly = {
    runs: [{ index: 0, rotationY: 0, offset: [0, 0, 0], span: max[0] - min[0], parts }],
    hardware: [],
    counts: { modules: 1, doors, drawers, angledCuts: 0, curvedCuts: 0 },
    ledMeters: own.filter((p) => p.kind === "led").reduce((m, p) => m + p.size[0] / 1000, 0),
    bounds: { min, max },
  };
  return { assembly, parts: own, doors, drawers };
}

// ------------------------------------------------------------------ precio y resumen

/** valores de muestra de lo que no sale de placa; como todo precio de la demo, hay que reemplazarlos */
const SAMPLE = { sofaModule: 520_000, sofaArm: 140_000, sofaChaise: 260_000, leg: 9_000, metalLeg: 22_000, ironPerMeter: 14_000 };

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
    } else if (p.label === "Pata") cost += p.material === "iron" ? SAMPLE.metalLeg : SAMPLE.leg;
    else if (p.material === "iron") cost += (Math.max(...p.size) / 1000) * SAMPLE.ironPerMeter;
    else if (p.material === "glass") {
      const [a, b] = [...p.size].sort((x, y) => y - x);
      cost += ((a * b) / 1e6) * catalog.fronts.glassPerM2;
    }
  }
  if (build.assembly.ledMeters > 0) cost += build.assembly.ledMeters * (catalog.led.whiteStripPerMeter + catalog.led.profilePerMeter + catalog.led.installPerMeter) + catalog.led.powerSupply60W;
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
