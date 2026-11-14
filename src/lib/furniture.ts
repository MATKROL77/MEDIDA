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
import { DECOR_MODELS, type DecorModel } from "./decor-models.ts";
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
  /**
   * Restricciones de fabricación: qué no se puede elegir con lo que ya está
   * elegido, y por qué. La clave es el control ("sides") o el control y la
   * opción ("foot:cajones"). Lo bloqueado se apaga solo y la interfaz lo
   * muestra deshabilitado con su motivo.
   */
  locks?: (v: Record<string, Value>) => Record<string, string>;
};

export const FABRICS = [
  { id: "arena", name: "Lino arena", color: "#b39f82", weave: "lino" },
  { id: "crudo", name: "Bouclé crudo", color: "#d8cdb9", weave: "boucle" },
  { id: "gris", name: "Lino gris piedra", color: "#8e8f8c", weave: "lino" },
  { id: "grafito", name: "Lino grafito", color: "#45474a", weave: "lino" },
  { id: "ocre", name: "Pana ocre", color: "#b9731f", weave: "pana" },
  { id: "bordo", name: "Pana bordó", color: "#6e1f24", weave: "pana" },
  { id: "botella", name: "Pana verde botella", color: "#1f4a37", weave: "pana" },
  { id: "azul", name: "Lino azul noche", color: "#2f3d55", weave: "lino" },
  { id: "marino", name: "Pana azul marino", color: "#2a3a5e", weave: "pana" },
  { id: "suela", name: "Cuero suela", color: "#8a5434", weave: "cuero" },
  { id: "cuero-negro", name: "Cuero negro", color: "#2a2624", weave: "cuero" },
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
      { key: "fronts", type: "choice", label: "Frentes", options: choice(["nicho-cajon", "Cajones y nicho"], ["mixto", "Combinado"], ["puertas", "Puertas"], ["cajones", "Cajones"], ["vidrio", "Vidrio"], ["abierto", "Nichos"]) },
      { key: "base", type: "choice", label: "Apoyo", options: choice(["patas", "Patas cónicas"], ["metal", "Patas de metal"], ["hierro", "Marco de hierro"], ["flotante", "Flotante"]) },
      { key: "grip", type: "choice", label: "Apertura", options: choice(["push", "Sin tirador"], ["unero", "Uñero"], ["barra", "Tirador"]) },
      { key: "thick", type: "toggle", label: "Tapa gruesa", hint: "Una tapa de 40 mm que sobresale apenas" },
      LED,
    ],
    defaults: { width: 2000, height: 450, depth: 420, fronts: "nicho-cajon", base: "metal", grip: "push", thick: true, led: true },
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
      { key: "style", type: "choice", label: "Modelo", options: choice(["recto", "Recto"], ["burbujas", "Burbujas"], ["curvo", "Curvo"]) },
      { key: "seats", type: "count", label: "Cuerpos", min: 1, max: 5 },
      { key: "seatWidth", type: "size", label: "Ancho de cada cuerpo", min: 700, max: 1100 },
      { key: "depth", type: "size", label: "Profundidad", min: 850, max: 1100 },
      { key: "base", type: "choice", label: "Apoyo", options: choice(["piso", "Al piso"], ["madera", "Base de madera"], ["patas", "Patas de madera"], ["metal", "Patas de metal"]) },
      { key: "chaise", type: "choice", label: "Chaise", options: choice(["no", "Sin chaise"], ["izquierda", "A la izquierda"], ["derecha", "A la derecha"]) },
      { key: "arms", type: "toggle", label: "Con apoyabrazos" },
      { key: "ottoman", type: "toggle", label: "Con puff", hint: "Un módulo suelto, sin respaldo" },
    ],
    defaults: { style: "recto", seats: 3, seatWidth: 900, depth: 980, base: "patas", chaise: "no", arms: true, ottoman: true },
    body: "nogal",
    front: "nogal",
    bodyLabel: "Zócalo o patas",
    frontLabel: null,
    upholstered: true,
  },
];

SPECS.push({
  id: "camas",
  label: "Cama",
  title: "Bases de cama",
  controls: [
    { key: "width", type: "size", label: "Ancho del colchón", min: 800, max: 2000 },
    { key: "length", type: "size", label: "Largo del colchón", min: 1900, max: 2100 },
    { key: "height", type: "size", label: "Alto de la base", min: 200, max: 450 },
    { key: "base", type: "choice", label: "Apoyo", options: choice(["caja", "Al piso"], ["patas", "Con patas"], ["flotante", "Flotante"]) },
    { key: "head", type: "choice", label: "Respaldo", options: choice(["biblioteca", "Con estantes"], ["tapizado", "Tapizado"], ["madera", "De madera"], ["no", "Sin respaldo"]) },
    { key: "foot", type: "choice", label: "A los pies", options: choice(["liso", "Liso"], ["puertas", "Puertas"], ["cajones", "Cajones"]) },
    { key: "sides", type: "toggle", label: "Cajones al costado", hint: "Dos cajones grandes del lado derecho" },
    { key: "upholstered", type: "toggle", label: "Base tapizada", hint: "Forrada en tela" },
    LED,
  ],
  defaults: { width: 1600, length: 2000, height: 400, base: "caja", head: "biblioteca", foot: "puertas", sides: true, upholstered: false, led: true },
  body: "nogal",
  front: "nogal",
  bodyLabel: "Madera",
  frontLabel: null,
  upholstered: true,
  locks(v) {
    const out: Record<string, string> = {};
    // el guardado necesita una caja cerrada hasta el piso, de madera y con altura para un cajón útil
    const why =
      v.base !== "caja" ? "El guardado va con la base al piso" : v.upholstered ? "Una base tapizada no lleva frentes de madera" : (v.height as number) < BED_STORAGE_MIN ? "Con guardado la base mide al menos 32 cm" : "";
    if (why) {
      out.sides = why;
      out["foot:puertas"] = why;
      out["foot:cajones"] = why;
    }
    // la luz va donde se ve: bajo una base flotante o en los estantes del respaldo
    if (v.base !== "flotante" && v.head !== "biblioteca") out.led = "La luz va bajo una base flotante o en el respaldo con estantes";
    return out;
  },
});

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
  // lo que no se puede con lo elegido se apaga (dos pasadas: apagar algo puede destrabar o trabar otra cosa)
  for (let pass = 0; pass < 2 && spec.locks; pass++) {
    const locked = spec.locks(values);
    for (const c of spec.controls) {
      if (c.type === "toggle" && locked[c.key]) values[c.key] = false;
      if (c.type === "choice" && locked[`${c.key}:${values[c.key]}`]) values[c.key] = c.options.find((o) => !locked[`${c.key}:${o.id}`])?.id ?? values[c.key];
    }
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
/** alto mínimo de una base con guardado: menos no deja un cajón útil */
const BED_STORAGE_MIN = 320;
/** profundidad de lo que se guarda: cajones y compartimentos */
const STORE_DEPTH = 560;
/** melamina blanca del interior de cajones y compartimentos, como en un mueble de verdad */
const INSIDE = "tint:#ece8e1";
/** a qué distancia de la pared queda lo que va en el medio del ambiente */
const ROOM_CENTER = 1900;
const NOT_BOARD = ["metal", "iron", "fabric", "handle", "glass", "led", "glow", "back"];

type Extra = Partial<Pick<Part, "front" | "hinge" | "openShift" | "details" | "geometry" | "module" | "decor" | "glow" | "openAngle">> & {
  noCut?: boolean;
  band?: Cut["band"];
  /** sale de placa aunque su material sea un color fijo (la melamina blanca de adentro) */
  board?: boolean;
};

/** una pieza: caja en el espacio y, si sale de placa, su medida de corte */
function piece(list: Part[], id: string, label: string, kind: PartKind, material: string, position: Vec3, size: Vec3, extra: Extra = {}): Part {
  const sorted = [...size].sort((a, b) => b - a);
  const flat = !extra.geometry || extra.geometry === "box" || extra.geometry === "soft";
  const board = extra.board || (!extra.noCut && !extra.decor && flat && Math.min(...size) <= 60 && !NOT_BOARD.includes(material) && !material.includes(":"));
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
    openAngle: extra.openAngle,
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

/**
 * Un cajón completo, que sale hacia adelante al abrir: frente con tirador y una
 * caja de melamina blanca con dos laterales, contrafrente (la pared de atrás)
 * y fondo de MDF.
 */
/**
 * Cómo se abre un frente: con un tirador de barra, con un uñero (la ranura
 * fresada en el canto de arriba, donde entran los dedos) o sin nada, con un
 * expulsor que lo abre al empujar.
 */
export type Grip = "barra" | "unero" | "push";

/** lo que lleva un frente para abrirlo, en coordenadas del frente */
function gripFor(id: string, grip: Grip, w: number, h: number, bar: Part): Part[] {
  if (grip === "push") return [];
  if (grip === "unero") return [{ ...bar, id: `${id}:u`, label: "Uñero", kind: "groove", material: "groove", position: [10, h - 26, T - 1.2], size: [w - 20, 12, 1.6] }];
  return [bar];
}

/**
 * Un cajón: el frente en (x, y, z) de w × h y la caja adentro. `opening` es el
 * hueco entre las caras del mueble (desde dónde, cuánto mide): la caja deja
 * 16 mm por lado para la corredera. Si no se da, el frente va metido 3 mm en el hueco.
 */
function drawer(list: Part[], id: string, module: number, x: number, y: number, z: number, w: number, h: number, depth: number, material: string, grip: Grip = "barra", opening: [number, number] = [x - 3, w + 6]) {
  const out: Vec3 = [0, 0, Math.min(depth - 60, 420)];
  piece(list, `${id}:f`, "Frente de cajón", "drawer-front", material, [x, y, z], [w, h, T], {
    front: true,
    module,
    openShift: out,
    band: { long: 2, short: 2 },
    details: gripFor(id, grip, w, h, handle(`${id}:h`, w / 2 - Math.min(70, w / 4), h - 30, Math.min(140, w / 2))),
  });
  drawerBox(list, id, module, out, [opening[0] + 16, y + 14, z - depth + 40], [opening[1] - 32, h - 46, depth - 40], "z");
}

/**
 * La caja de un cajón, dentro del rectángulo dado. `along` dice hacia dónde
 * sale: "z" hacia adelante, "x" hacia el costado. Lleva laterales, contrafrente
 * y fondo, así al abrirlo se ve un cajón de verdad y no tres tablas sueltas.
 */
function drawerBox(list: Part[], id: string, module: number, out: Vec3, [x, y, z]: Vec3, [w, h, d]: Vec3, along: "x" | "z") {
  const s = 15;
  const box = { module, openShift: out, board: true, band: { long: 1, short: 0 } as Cut["band"] };
  if (along === "z") {
    piece(list, `${id}:l`, "Lateral de cajón", "drawer-side", INSIDE, [x, y, z], [s, h, d], box);
    piece(list, `${id}:r`, "Lateral de cajón", "drawer-side", INSIDE, [x + w - s, y, z], [s, h, d], box);
    piece(list, `${id}:k`, "Contrafrente de cajón", "drawer-end", INSIDE, [x + s, y, z], [w - 2 * s, h - 10, s], box);
    piece(list, `${id}:b`, "Fondo de cajón", "drawer-bottom", "back", [x + s, y, z + s], [w - 2 * s, 3, d - s], { module, openShift: out });
  } else {
    piece(list, `${id}:l`, "Lateral de cajón", "drawer-side", INSIDE, [x, y, z], [w, h, s], box);
    piece(list, `${id}:r`, "Lateral de cajón", "drawer-side", INSIDE, [x, y, z + d - s], [w, h, s], box);
    piece(list, `${id}:k`, "Contrafrente de cajón", "drawer-end", INSIDE, [x, y, z + s], [s, h - 10, d - 2 * s], box);
    piece(list, `${id}:b`, "Fondo de cajón", "drawer-bottom", "back", [x + s, y, z + s], [w - s, 3, d - 2 * s], { module, openShift: out });
  }
}

/** puerta batiente; con bisagra abajo ("bottom") es rebatible: se abre hacia adelante, como una tapa */
function door(list: Part[], id: string, x: number, y: number, z: number, w: number, h: number, material: string, hinge: "left" | "right" | "bottom", grip: Grip = "barra") {
  const glass = material === "glass";
  const bar =
    hinge === "bottom"
      ? handle(`${id}:h`, w / 2 - Math.min(70, w / 4), h - 30, Math.min(140, w / 2))
      : handle(`${id}:h`, hinge === "left" ? w - 40 : 30, Math.max(20, h / 2 - 60), Math.min(120, h - 40), true);
  piece(list, id, glass ? "Puerta de vidrio" : hinge === "bottom" ? "Puerta rebatible" : "Puerta", "door", material, [x, y, z], [w, h, glass ? 8 : T], {
    front: true,
    hinge,
    // una rebatible baja casi hasta quedar horizontal, frenada por su compás
    openAngle: hinge === "bottom" ? (78 * Math.PI) / 180 : undefined,
    band: { long: 2, short: 2 },
    // el vidrio siempre lleva tirador: no se puede fresar ni empujar sin marcarlo
    details: glass ? [bar] : gripFor(id, grip, w, h, bar),
  });
}

/**
 * Capitoné: la cara se hunde en una grilla de botones forrados, como en los
 * sillones de módulos acolchados. Cada botón es una pieza más del almohadón.
 */
function tufted(p: Part, face: "top" | "front", nx: number, ny: number, depth: number): Part {
  p.tuft = { face, nx, ny, depth };
  const [sx, sy, sz] = p.size;
  const buttons: Part[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const u = ((i + 0.5) * sx) / nx;
      const v = ((j + 0.5) * (face === "top" ? sz : sy)) / ny;
      // el botón queda en el fondo del hundido, apenas asomado
      const position: Vec3 = face === "top" ? [u - 13, sy - depth - 4, v - 13] : [u - 13, v - 13, sz - depth - 4];
      buttons.push({ id: `${p.id}:btn${i}${j}`, label: "Botón forrado", kind: "handle", material: "fabric", run: 0, module: null, position, size: [26, face === "top" ? 16 : 26, face === "top" ? 26 : 16], geometry: "knob", cut: null, explode: [0, 0, 0] });
    }
  }
  p.details = [...(p.details ?? []), ...buttons];
  return p;
}

/** cuatro patas en las esquinas de un rectángulo, metidas `inset` desde cada borde */
function legs(list: Part[], prefix: string, x0: number, z0: number, w: number, d: number, h: number, kind: "recta" | "conica" | "hierro" | "metal", material: string, inset: number) {
  const s = kind === "hierro" ? 28 : kind === "metal" ? 30 : kind === "conica" ? 58 : 64;
  for (const [i, [x, z]] of [
    [x0 + inset, z0 + inset],
    [x0 + w - inset - s, z0 + inset],
    [x0 + inset, z0 + d - inset - s],
    [x0 + w - inset - s, z0 + d - inset - s],
  ].entries()) {
    piece(list, `${prefix}:${i}`, "Pata", "plinth", kind === "hierro" || kind === "metal" ? "iron" : material, [x, 0, z], [s, h, s], { geometry: kind === "conica" ? "cone" : kind === "metal" ? "cyl" : "box", noCut: true });
  }
}

/** tira LED: una línea de luz y, opcional, su resplandor sobre el piso */
function led(list: Part[], id: string, x: number, y: number, z: number, length: number, pool?: { y: number; depth: number }) {
  piece(list, id, "Tira LED", "led", "led", [x, y, z], [length, 6, 10], { noCut: true });
  // el charco de luz es más grande que la tira: se abre y se apaga suave
  if (pool) piece(list, `${id}:g`, "Luz", "glow", "glow", [x - 260, pool.y, z - pool.depth * 0.8], [length + 520, 2, pool.depth * 1.6], { geometry: "glow", glow: "y", noCut: true });
}

// ---- ambientación: lo que rodea al mueble para verlo en un lugar de verdad

const deco = { decor: true, noCut: true } as const;
const BOOKS = ["#7b2f2a", "#e8e1d2", "#2f3b4a", "#b98b3e", "#d8d2c6", "#3d4a3a", "#8a8a86", "#c9b79c"];

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
/**
 * Un objeto escaneado de verdad (public/models, de Poly Haven), apoyado con su
 * esquina mínima en (x, y, z) y a su medida real: no se estira.
 */
function prop(list: Part[], id: string, label: string, model: DecorModel, x: number, y: number, z: number, scale = 1): Part {
  const [w, h, d] = DECOR_MODELS[model].map((v) => v * scale);
  const p = piece(list, id, label, "shelf", "none", [x, y, z], [w, h, d], { ...deco, geometry: "model" });
  p.model = model;
  return p;
}

/** lo que se apoya sobre una tapa: un jarrón de cerámica en la punta y un cuenco de madera al lado */
function tabletop(list: Part[], id: string, x: number, y: number, z: number) {
  prop(list, `${id}:jarron`, "Jarrón", "jarron-alto", x, y, z + 60);
  prop(list, `${id}:cuenco`, "Cuenco", "cuenco", x + 160, y, z);
}

/**
 * Lo que va en un estante: si entra, una hilera de libros de verdad; si no,
 * un jarroncito o un portarretrato; en un hueco muy chico, libros simples.
 */
function shelfDecor(list: Part[], id: string, x: number, y: number, z: number, width: number, space: number, seed: number) {
  const [lw, lh] = DECOR_MODELS.libros;
  const [bw, bh] = DECOR_MODELS["jarron-bronce"];
  const [fw, fh] = DECOR_MODELS.portarretrato;
  // los libros se achican enteros hasta entrar (hay libros de todos los tamaños), nunca menos del 75 %
  const k = Math.min(1, (width - 10) / lw, (space - 15) / lh);
  const kind = seed % 4;
  if (kind !== 3 && k >= 0.75) prop(list, `${id}:libros`, "Libros", "libros", x + 5, y, z, k);
  else if (kind === 3 && seed % 8 === 3 && width >= fw + 40 && space >= fh + 30) prop(list, `${id}:foto`, "Portarretrato", "portarretrato", x + width * 0.3, y, z);
  else if (width >= bw + 40 && space >= bh + 30) prop(list, `${id}:jarron`, "Jarrón", "jarron-bronce", x + width / 2 - bw / 2, y, z + 20);
  else books(list, id, x, y, z, 4 + (seed % 3), 150);
}
function lamp(list: Part[], id: string, x: number, y: number, z: number) {
  piece(list, `${id}:base`, "Lámpara", "shelf", "gloss:#b9a27c", [x, y, z], [110, 14, 110], { ...deco, geometry: "cyl" });
  piece(list, `${id}:stem`, "Lámpara", "shelf", "gloss:#b9a27c", [x + 48, y + 14, z + 48], [14, 230, 14], { ...deco, geometry: "cyl" });
  piece(list, `${id}:shade`, "Lámpara", "shelf", "tint:#efe7d8", [x - 35, y + 220, z - 35], [180, 120, 180], { ...deco, geometry: "cone" });
}

/** `wall`: el mueble va contra una pared (la tele, lo que se cuelga, lo que se apoya atrás) */
type Builder = (v: Record<string, Value>, c: FurnitureConfig) => { parts: Part[]; drawers: number; doors: number; center?: boolean; gap?: number; wall?: boolean };

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
      lamp(parts, "deco:lamp", w * 0.5 - 55, topY, d * 0.3);
      return { parts, drawers, doors: 0, wall: true };
    }
    tabletop(parts, "deco:top", w * 0.18, topY, d * 0.3);
    return { parts, drawers, doors: 0, center: true };
  },

  tv(v, c) {
    const w = v.width as number;
    const h = v.height as number;
    const d = v.depth as number;
    const parts: Part[] = [];
    const floating = v.base === "flotante";
    const base = floating ? 260 : v.base === "hierro" ? 200 : v.base === "metal" ? 120 : 150;
    const modules = Math.max(2, Math.round(w / 600));
    const mw = (w - T) / modules;
    const grip = v.grip as Grip;
    // tapa gruesa: 40 mm (dos placas encoladas) y 15 mm de vuelo adelante y a los costados
    if (v.thick) piece(parts, "top", "Tapa", "top", c.front, [-15, base + h - T, 0], [w + 30, 40, d + 15], { band: { long: 2, short: 2 } });
    else piece(parts, "top", "Tapa", "top", c.front, [0, base + h - T, 0], [w, T, d], { band: { long: 2, short: 2 } });
    piece(parts, "bottom", "Piso", "bottom", c.body, [0, base, 0], [w, T, d], { band: { long: 1, short: 2 } });
    const kinds = Array.from({ length: modules }, (_, i) => (v.fronts === "mixto" ? ["puertas", "abierto", "cajones", "vidrio"][i % 4] : (v.fronts as string)));
    const fronted = (k: string | undefined) => k === "puertas" || k === "vidrio" || k === "cajones" || k === "nicho-cajon";
    const inner = h - 2 * T;
    // nicho y cajón: los cajones abajo, y arriba un solo nicho corrido de punta
    // a punta, como en los muebles de catálogo; los divisores quedan abajo
    const niche = v.fronts === "nicho-cajon";
    const fh = Math.round(inner * 0.56);
    // un divisor entre dos módulos con frente queda 18 mm atrás y los frentes
    // lo tapan a medias, con 3 mm de luz entre uno y otro (como en un mueble
    // real); al lado de un módulo abierto llega hasta adelante
    const recessed = (i: number) => i > 0 && i < modules && fronted(kinds[i - 1]) && fronted(kinds[i]);
    for (let i = 0; i <= modules; i++) {
      const end = i === 0 || i === modules;
      const height = niche && !end ? fh : h - 2 * T;
      piece(parts, `div:${i}`, end ? "Lateral" : "Divisor", end ? "side" : "divider", c.body, [i * mw, base + T, 0], [T, height, d - (recessed(i) ? T : 0)]);
    }
    if (niche) {
      piece(parts, "shelf", "Estante", "fixed-shelf", c.body, [T, base + T + fh, 0], [w - 2 * T, T, d], { band: { long: 1, short: 0 } });
      // más de 2,2 m sin apoyo la tapa se vence: un parante al medio del nicho
      if (w > 2200) piece(parts, "div:niche", "Parante", "divider", c.body, [w / 2 - T / 2, base + T + fh + T, 0], [T, h - 3 * T - fh, d]);
      if (v.led) led(parts, "led:niche", T + 20, base + h - T - 8, d - 50, w - 2 * T - 40);
    }
    piece(parts, "back", "Fondo", "back", "back", [T, base + T, 0], [w - 2 * T, h - 2 * T, 3]);
    if (v.base === "patas") legs(parts, "leg", 0, 0, w, d, base, "conica", c.body, 90);
    if (v.base === "metal") legs(parts, "leg", 0, 0, w, d, base, "metal", "iron", 60);
    if (v.base === "hierro") {
      legs(parts, "leg", 0, 0, w, d, base, "hierro", "iron", 70);
      for (const [id, z] of [["f", d - 98], ["b", 70]] as const) piece(parts, `bar:${id}`, "Larguero de hierro", "divider", "iron", [98, base - 28, z], [w - 196, 28, 28], { noCut: true });
    }
    let drawers = 0;
    let doors = 0;
    for (let i = 0; i < modules; i++) {
      // el hueco entre las caras de los divisores, y el frente: hasta el medio
      // del divisor si está retirado, o 3 mm adentro de la cara si llega adelante
      const opening: [number, number] = [i * mw + T, mw - T];
      const left = recessed(i) ? i * mw + T / 2 + 1.5 : i * mw + T + 3;
      const right = recessed(i + 1) ? (i + 1) * mw + T / 2 - 1.5 : (i + 1) * mw - 3;
      const x = left;
      const fw = right - left;
      const kind = kinds[i];
      if (kind === "puertas" || kind === "vidrio") {
        if (kind === "vidrio") piece(parts, `shelf:${i}`, "Estante", "shelf", c.body, [i * mw + T, base + T + inner / 2, 0], [mw - T, T, d - 50]);
        door(parts, `door:${i}`, x, base + T + 3, d - (kind === "vidrio" ? 8 : T), fw, inner - 6, kind === "vidrio" ? "glass" : c.front, i % 2 ? "right" : "left", grip);
        doors++;
      } else if (kind === "nicho-cajon") {
        drawer(parts, `dr${i}:0`, i, x, base + T + 4, d - T, fw, fh - 8, d - T, c.front, grip, opening);
        drawers++;
        if (i % 2 === 1) prop(parts, `deco:n${i}`, "Cuenco", "cuenco", i * mw + T + mw * 0.3, base + T + fh + T, d * 0.25);
      } else if (kind === "cajones") {
        const n = inner > 380 ? 2 : 1;
        const dh = (inner - 4 * (n + 1)) / n;
        for (let k = 0; k < n; k++) drawer(parts, `dr${i}:${k}`, i, x, base + T + 4 + k * (dh + 4), d - T, fw, dh, d - T, c.front, grip, opening);
        drawers += n;
      } else {
        piece(parts, `shelf:${i}`, "Estante", "shelf", c.body, [i * mw + T, base + T + inner / 2, 0], [mw - T, T, d - 30]);
        // en un nicho abierto la luz va arriba, escondida detrás del canto
        if (v.led) led(parts, `led:n${i}`, i * mw + T + 20, base + h - T - 8, d - 50, mw - T - 40);
        // y adentro, unos libros acostados o una suculenta
        if (i % 2 === 0) prop(parts, `deco:n${i}`, "Suculenta", "suculenta", i * mw + T + mw * 0.35, base + T + inner / 2 + T, d * 0.3);
      }
    }
    // la luz de abajo es para el mueble colgado: con patas no tiene dónde rebotar
    if (v.led && floating) led(parts, "led:under", 60, base - 8, d * 0.45, w - 120, { y: 4, depth: d * 1.5 });
    // la tele en la pared, y algo apoyado arriba
    const tw = Math.min(w * 0.72, 1650);
    piece(parts, "deco:tv", "Televisor", "back", "gloss:#0b0b0c", [(w - tw) / 2, base + h + 330, 20], [tw, tw * 0.57, 45], deco);
    // la barra de sonido, colgada justo debajo de la tele
    const bw = Math.min(tw * 0.62, 950);
    piece(parts, "deco:sound", "Barra de sonido", "back", "tint:#1a1a1b", [(w - bw) / 2, base + h + 330 - 75, 30], [bw, 62, 90], { ...deco, geometry: "cushion" }).radius = 18;
    const topY = base + h - T + (v.thick ? 40 : T);
    // arriba, como en las fotos de catálogo: un jarrón y un cuenco en una punta, una suculenta en la otra
    tabletop(parts, "deco:top", w * 0.04, topY, d * 0.25);
    prop(parts, "deco:top:planta", "Suculenta", "suculenta", w * 0.9 - 168, topY, d * 0.3);
    return { parts, drawers, doors, wall: true };
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
          if (k < levels - 1 && (i + k) % 2 === 0) shelfDecor(parts, `deco:b${i}:${k}`, i * cw + s + 20, y + T + 10, 30, cw - s - 40, (h - 120 - T) / (levels - 1) - T - 10, i + k);
        }
      }
      if (v.back) piece(parts, "back", "Fondo", "back", "back", [s, 120, 0], [w - 2 * s, h - 120, 3]);
      return { parts, drawers: 0, doors, wall: true };
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
        if ((i + k) % 2 === 1 && y + 280 < h) shelfDecor(parts, `deco:b${i}:${k}`, x + 20, y + T, 30, sw - 40, free / (n + 1) - T, i + k);
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
    return { parts, drawers: 0, doors, wall: true };
  },

  camas(v, c) {
    const mw = v.width as number;
    const ml = v.length as number;
    const h = v.height as number;
    const parts: Part[] = [];
    const soft = v.upholstered === true;
    const t = soft ? 60 : 36;
    const w = mw + 2 * t;
    const head = v.head === "no" ? 0 : v.head === "tapizado" ? 110 : v.head === "biblioteca" ? 240 : 40;
    const storeSide = v.sides === true;
    const storeFoot = v.foot as string;
    const storage = storeSide || storeFoot !== "liso";
    let drawers = 0;
    let doors = 0;
    const z0 = head;
    const len = ml + t;
    // con una base baja el marco no puede quedar más fino que un larguero
    const lift = v.base === "caja" ? 0 : Math.min(v.base === "flotante" ? 170 : 150, h - 120);
    const rail = h - lift;
    const cush = (): Extra => ({ geometry: "cushion", noCut: true });
    const wrap = (id: string, label: string, kind: PartKind, pos: Vec3, size: Vec3) => {
      const p = piece(parts, id, label, kind, soft ? "fabric" : c.body, pos, size, soft ? cush() : { band: { long: 2, short: 2 } });
      if (soft) p.radius = 28;
    };
    // el marco: dos largueros y la piecera. Con guardado, los frentes ocupan su lugar
    wrap("rail:l", "Larguero", "side", [0, lift, z0], [t, rail, len]);
    if (!storeSide) wrap("rail:r", "Larguero", "side", [w - t, lift, z0], [t, rail, len]);
    if (storeFoot === "liso") wrap("foot", "Piecera", "side", [t, lift, z0 + len - t], [mw, rail, t]);

    if (!storage) {
      // el colchón apoya sobre tablas, no sobre una placa entera
      const slats = Math.max(6, Math.round(ml / 170));
      for (let i = 0; i < slats; i++) piece(parts, `slat:${i}`, "Tabla del elástico", "shelf", c.body, [t, h - 70, z0 + 40 + ((ml - 170) * i) / (slats - 1)], [mw, 20, 90]);
      piece(parts, "spine", "Larguero central", "divider", c.body, [w / 2 - 9, lift, z0 + 20], [T, Math.max(40, rail - 70), ml - 40]);
    } else {
      // con guardado, una caja cerrada: tapa entera arriba y piso falso abajo,
      // en paneles que entran en la placa
      const yTop = h - 50 - T;
      const yFloor = 40;
      const panels = Math.ceil(mw / 1780);
      const pw = mw / panels;
      for (let k = 0; k < panels; k++) {
        piece(parts, `deck:${k}`, "Tapa de la base", "top", c.body, [t + k * pw, yTop, z0 + T], [pw - (k < panels - 1 ? 2 : 0), T, len - t - T], { band: { long: 0, short: 1 } });
        piece(parts, `floor:${k}`, "Piso falso", "bottom", INSIDE, [t + k * pw, yFloor, z0 + T], [pw - (k < panels - 1 ? 2 : 0), T, len - T - (storeFoot === "liso" ? t : T)], { board: true });
      }
      // tacos bajo el piso falso: lo separan del piso de la casa
      for (let k = 0; k <= panels; k++) piece(parts, `cleat:${k}`, "Taco del piso falso", "plinth", INSIDE, [t + Math.min(k * pw, mw - 60), 0, z0 + T], [60, yFloor, len - 2 * T - t], { board: true });
      piece(parts, "back:head", "Cabecera de la caja", "divider", c.body, [t, yFloor + T, z0], [mw, yTop - yFloor - T, T]);

      const inner = yTop - yFloor - T;
      const fy = 24;
      const fh = h - 4 - fy;
      // a los pies: un compartimento de 56 cm con su pared de fondo y un divisor al medio
      const zBackFoot = z0 + len - T - STORE_DEPTH - T;
      if (storeFoot !== "liso") {
        piece(parts, "wall:foot", "Pared de fondo del guardado", "divider", INSIDE, [t, yFloor + T, zBackFoot], [mw, inner, T], { board: true });
        piece(parts, "wall:mid", "Divisor del guardado", "divider", INSIDE, [w / 2 - T / 2, yFloor + T, zBackFoot + T], [T, inner, STORE_DEPTH], { board: true });
        const dw = (mw - 9) / 2;
        for (let k = 0; k < 2; k++) {
          const x = t + 3 + k * (dw + 3);
          if (storeFoot === "cajones") {
            drawer(parts, `dr${k}`, k, x, fy, z0 + len - T, dw, fh, STORE_DEPTH, c.front);
            drawers++;
          } else {
            door(parts, `door${k}`, x, fy, z0 + len - T, dw, fh, c.front, "bottom");
            doors++;
          }
        }
        // con guardado al costado, el larguero derecho sigue entero junto a los pies
        if (storeSide) wrap("rail:r:foot", "Larguero", "side", [w - t, lift, zBackFoot], [t, rail, z0 + len - zBackFoot]);
      }
      // al costado: dos cajones grandes que salen hacia la derecha, entre parantes
      if (storeSide) {
        const zEnd = storeFoot !== "liso" ? zBackFoot : z0 + len;
        const span = zEnd - z0 - 2 * t - (storeFoot === "liso" ? 0 : 0);
        const dl = (span - T) / 2;
        const out: Vec3 = [STORE_DEPTH - 80, 0, 0];
        wrap("post:b", "Parante", "side", [w - t, lift, z0], [t, rail, t]);
        wrap("post:m", "Parante", "side", [w - t, lift, z0 + t + dl], [t, rail, T]);
        if (storeFoot === "liso") wrap("post:f", "Parante", "side", [w - t, lift, z0 + len - t], [t, rail, t]);
        // la pared contra la que corren las guías de los cajones
        piece(parts, "wall:side", "Pared del guardado lateral", "divider", INSIDE, [w - t - STORE_DEPTH - T, yFloor + T, z0 + T], [T, inner, zEnd - z0 - T], { board: true });
        for (let k = 0; k < 2; k++) {
          const z = z0 + t + 3 + k * (dl + T);
          const grip: Part = { id: `sd${k}:h`, label: "Tirador", kind: "handle", material: "handle", run: 0, module: null, position: [T, fh - 30, dl / 2 - 70], size: [26, 10, 140], geometry: "box", cut: null, explode: [0, 0, 0] };
          piece(parts, `sd${k}:f`, "Frente de cajón", "drawer-front", c.front, [w - T, fy, z], [T, fh, dl - 6], { front: true, module: 10 + k, openShift: out, band: { long: 2, short: 2 }, details: [grip] });
          drawerBox(parts, `sd${k}`, 10 + k, out, [w - T - STORE_DEPTH + 20, fy + 14, z + 12], [STORE_DEPTH - 20, fh - 46, dl - 30], "x");
          drawers++;
        }
      }
    }

    if (v.head === "tapizado") {
      const p = piece(parts, "head", "Respaldo tapizado", "back", "fabric", [-40, 0, 0], [w + 80, h + 780, head], cush());
      p.radius = 48;
    } else if (v.head === "madera") {
      piece(parts, "head", "Respaldo", "back", c.body, [-60, 0, 0], [w + 120, h + 700, 36], { band: { long: 2, short: 2 } });
    }

    if (v.head === "biblioteca") {
      // respaldo con estantes: un fondo, una tapa para apoyar cosas y nichos con luz
      const hw = w + 120;
      const top = h + 620;
      piece(parts, "head", "Fondo del respaldo", "back", c.body, [-60, 0, 0], [hw, top, T], { band: { long: 1, short: 2 } });
      piece(parts, "head:top", "Tapa del respaldo", "top", c.body, [-60, top - T, T], [hw, T, head - T], { band: { long: 2, short: 2 } });
      piece(parts, "head:shelf", "Estante del respaldo", "shelf", c.body, [-60 + T, h + 300, T], [hw - 2 * T, T, head - T - 20]);
      piece(parts, "head:front", "Frente del respaldo", "blind", c.body, [-60, 0, head - T], [hw, h + 300, T], { band: { long: 1, short: 0 } });
      const cells = Math.max(2, Math.round(hw / 620));
      for (let k = 0; k <= cells; k++) piece(parts, `head:div${k}`, k === 0 || k === cells ? "Lateral del respaldo" : "Divisor del respaldo", "divider", c.body, [-60 + ((hw - T) * k) / cells, h + 300 + T, T], [T, top - h - 300 - 2 * T, head - T - 20]);
      if (v.led) led(parts, "led:head", -60 + 40, top - T - 8, head - 50, hw - 80);
      shelfDecor(parts, "deco:hb", -60 + T + 20, h + 300 + T, 40, (hw - T) / cells - T - 40, top - h - 300 - 2 * T, 0);
    }

    if (v.base === "patas") {
      legs(parts, "leg", 0, z0, w, len, lift, "conica", c.body, 70);
      if (mw > 1300) for (const [k, z] of [z0 + 70, z0 + len - 128].entries()) piece(parts, `leg:m${k}`, "Pata", "plinth", c.body, [w / 2 - 29, 0, z], [58, lift, 58], { geometry: "cone", noCut: true });
    } else if (v.base === "flotante") {
      // el zócalo va metido hacia adentro y a oscuras: la cama parece no tocar el piso
      piece(parts, "plinth", "Zócalo", "plinth", "tint:#201812", [220, 0, z0 + 220], [w - 440, lift, len - 440], { noCut: true });
    }
    if (v.led && v.base === "flotante") led(parts, "led", 260, lift - 8, z0 + len * 0.5, w - 520, { y: 5, depth: len * 1.25 });

    // lo que la viste: colchón, acolchado y almohadas; una mesa de luz a cada lado
    const my = h - 50;
    // tela de lino de verdad, con arrugas: un acolchado nunca está liso
    const c1 = (id: string, label: string, color: string, pos: Vec3, size: Vec3, radius: number, wrinkle = 0) => {
      const p = piece(parts, id, label, "shelf", `linen:${color}`, pos, size, { ...deco, geometry: "cushion" });
      p.radius = radius;
      if (wrinkle) p.wrinkle = wrinkle;
    };
    c1("deco:mattress", "Colchón", "#ece6dc", [t + 5, my, z0 + 10], [mw - 10, 250, ml - 20], 80, 3);
    // el acolchado cubre de las almohadas a los pies y cae por los costados y adelante
    const dl = ml * 0.68;
    const hang = 200;
    c1("deco:duvet", "Acolchado", "#cfc4b3", [t + 5 - hang, my + 228, z0 + ml - dl], [mw - 10 + 2 * hang, 52, dl + hang], 22, 9);
    const duvet = parts[parts.length - 1];
    duvet.drape = { w: mw + 6, d: dl + 8, drop: 200 };
    const pillows = mw > 1200 ? 2 : 1;
    const pw = Math.min(700, mw / pillows - 60);
    for (let k = 0; k < pillows; k++) c1(`deco:pillow${k}`, "Almohada", "#f6f2ea", [t + (mw / pillows) * k + (mw / pillows - pw) / 2, my + 240, z0 + 60], [pw, 150, 420], 70, 6);
    return { parts, drawers, doors, wall: v.head !== "no" };
  },

  sillones(v, c) {
    const seats = v.seats as number;
    const sw = v.seatWidth as number;
    const d = v.depth as number;
    const parts: Part[] = [];
    const style = v.style as string;
    const bubbles = style === "burbujas";
    const curved = style === "curvo";
    // base de madera: un zócalo a la vista, apenas metido, que sigue la forma del sillón
    const lift = v.base === "piso" ? 36 : v.base === "madera" ? 120 : 150;
    const arm = v.arms && !bubbles ? 190 : 0;
    const total = seats * sw + 2 * arm;
    // radio del arco de un sillón curvo: más cerrado cuanto más corto
    const R = Math.max(1900, seats * sw * 0.95);
    const step = curved ? 2 * Math.asin(sw / (2 * R)) : 0;

    /** un punto del arco del sillón curvo, a un ángulo dado, mirando hacia el centro */
    const frameAt = (phi: number) => ({ cx: total / 2 + R * Math.sin(phi), cz: d / 2 + R * (1 - Math.cos(phi)), ry: -phi });
    /** un módulo: dónde está su centro y cuánto gira. En el curvo, los extremos vienen hacia adelante */
    const frame = (i: number) => (curved ? frameAt((i - (seats - 1) / 2) * step) : { cx: arm + i * sw + sw / 2, cz: d / 2, ry: 0 });
    /** el ángulo de cada punta del arco */
    const half = (seats * step) / 2;
    /**
     * En el curvo, la base y el respaldo son una sola pieza que sigue la curva,
     * como en un sillón curvo de verdad: sin tramos rectos ni ranuras entre módulos.
     */
    const arcPart = (id: string, label: string, kind: PartKind, y: number, h: number, rIn: number, rOut: number, round: number, material = "fabric") => {
      const cx = total / 2;
      const cz = d / 2 + R;
      // punto = centro + r·(sen θ, cos θ): el ángulo del sillón (φ) es θ = π − φ
      const start = Math.PI - half;
      const length = 2 * half;
      let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity];
      for (let k = 0; k <= 48; k++) {
        const t = start + (length * k) / 48;
        for (const r of [rIn, rOut]) {
          x0 = Math.min(x0, cx + r * Math.sin(t));
          x1 = Math.max(x1, cx + r * Math.sin(t));
          z0 = Math.min(z0, cz + r * Math.cos(t));
          z1 = Math.max(z1, cz + r * Math.cos(t));
        }
      }
      const p = piece(parts, id, label, kind, material, [x0, y, z0], [x1 - x0, h, z1 - z0], { geometry: "arc", noCut: true });
      p.arc = { cx, cz, rIn, rOut, start, length, round };
      return p;
    };
    /** una pieza del módulo, dada en coordenadas del módulo (x a lo ancho, z de atrás hacia adelante, desde su centro) */
    const put = (f: { cx: number; cz: number; ry: number }, id: string, label: string, kind: PartKind, material: string, lx: number, y: number, lz: number, size: Vec3, radius: number, extra: Extra = {}) => {
      const cos = Math.cos(f.ry);
      const sin = Math.sin(f.ry);
      const x = f.cx + lx * cos + lz * sin;
      const z = f.cz - lx * sin + lz * cos;
      const p = piece(parts, id, label, kind, material, [x - size[0] / 2, y, z - size[2] / 2], size, { geometry: "cushion", noCut: true, ...extra });
      p.radius = radius;
      if (f.ry) p.rotationY = f.ry;
      return p;
    };
    const supports = (f: { cx: number; cz: number; ry: number }, id: string, w: number, depth: number, lz = 0) => {
      // con base de madera el zócalo es uno solo, abajo de todo
      if (v.base === "madera") return;
      if (v.base === "piso") {
        // al piso: un zócalo oscuro metido hacia adentro, que queda en sombra y no se ve
        put(f, `${id}:plinth`, "Zócalo", "plinth", "tint:#241c16", 0, 0, lz, [w - (bubbles ? 340 : 150), lift + 6, depth - (bubbles ? 340 : 170)], 4, { geometry: "box" });
        return;
      }
      const metal = v.base === "metal";
      const s = metal ? 26 : 62;
      for (const [k, [lx, dz]] of [
        [-w / 2 + 90, -depth / 2 + 110],
        [w / 2 - 90, -depth / 2 + 110],
        [-w / 2 + 90, depth / 2 - 110],
        [w / 2 - 90, depth / 2 - 110],
      ].entries()) {
        put(f, `${id}:leg${k}`, "Pata", "plinth", metal ? "iron" : c.body, lx, 0, lz + dz, [s, lift + 12, s], 2, { geometry: metal ? "cyl" : "cone" });
      }
    };

    if (v.base === "madera") {
      if (curved) arcPart("plinth", "Zócalo curvo de madera", "plinth", 0, lift, R - d / 2 + 25, R + d / 2 - 25, 6, c.body);
      else {
        piece(parts, "plinth", "Zócalo de madera", "plinth", c.body, [20, 0, 25], [total - 40, lift, d - 50], { noCut: true });
        // bajo la chaise, el zócalo sigue hacia adelante
        if (v.chaise !== "no" && !bubbles) {
          const x = v.chaise === "izquierda" ? arm + 20 : arm + (seats - 1) * sw + 20;
          piece(parts, "plinth:chaise", "Zócalo de madera", "plinth", c.body, [x, 0, d - 25], [sw - 40, lift, 640], { noCut: true });
        }
      }
    }
    if (curved && !bubbles) {
      // todo de una pieza: base, respaldo, un solo almohadón de asiento y uno de respaldo a lo largo de la curva
      arcPart("base", "Base", "bottom", lift, 210, R - d / 2, R + d / 2, 55);
      arcPart("backrest", "Respaldo", "back", lift + 60, 640, R + d / 2 - 220, R + d / 2, 90);
      arcPart("seat", "Almohadón de asiento", "shelf", lift + 190, 190, R - d / 2 + 15, R + d / 2 - 205, 85);
      arcPart("pillow", "Almohadón de respaldo", "fixed-shelf", lift + 350, 430, R + d / 2 - 400, R + d / 2 - 195, 100);
    }
    for (let i = 0; i < seats; i++) {
      const f = frame(i);
      const chaise = !curved && ((v.chaise === "izquierda" && i === 0) || (v.chaise === "derecha" && i === seats - 1));
      const depth = chaise ? d + 640 : d;
      const fz = (depth - d) / 2;
      if (bubbles) {
        // cada cuerpo es un almohadón grande, capitoné: botones hundidos cada 30 cm
        // más o menos y la tela inflada entre ellos
        const seatD = depth - 300;
        const across = Math.max(2, Math.round(sw / 300));
        const rows = Math.max(2, Math.round(seatD / 320));
        tufted(put(f, `seat:${i}`, "Almohadón de asiento", "shelf", "fabric", 0, lift, -d / 2 + 300 + seatD / 2, [sw - 8, 380, seatD - 6], 105), "top", across, rows, 80);
        tufted(put(f, `back:${i}`, "Almohadón de respaldo", "back", "fabric", 0, lift + 230, -d / 2 + 160, [sw - 8, 420, 320], 120), "front", across, 1, 64);
      } else {
        if (!curved) {
          put(f, `base:${i}`, "Base del módulo", "bottom", "fabric", 0, lift, fz, [sw, 210, depth], 55);
          put(f, `backrest:${i}`, "Respaldo", "back", "fabric", 0, lift + 60, -d / 2 + 110, [sw, 640, 220], 90);
          put(f, `seat:${i}`, "Almohadón de asiento", "shelf", "fabric", 0, lift + 190, fz + 100, [sw - 10, 190, depth - 215], 85);
          put(f, `pillow:${i}`, "Almohadón de respaldo", "fixed-shelf", "fabric", 0, lift + 350, -d / 2 + 300, [sw - 26, 430, 210], 100);
        }
      }
      supports(f, `sup:${i}`, sw, depth, fz);
    }

    if (v.arms) {
      const ends: [string, number, number][] = [["l", 0, -1], ["r", seats - 1, 1]];
      for (const [id, i, side] of ends) {
        // en el curvo, el apoyabrazos arranca justo donde termina el arco
        const f = curved ? frameAt(side * half) : frame(i);
        const chaise = !curved && ((v.chaise === "izquierda" && i === 0) || (v.chaise === "derecha" && i === seats - 1));
        const depth = chaise ? d + 640 : d;
        if (bubbles) put(f, `arm:${id}`, "Almohadón apoyabrazos", "side", "fabric", side * (sw / 2 - 150), lift + 340, 120, [290, 300, d - 420], 140);
        else put(f, `arm:${id}`, "Apoyabrazos", "side", "fabric", side * ((curved ? 0 : sw / 2) + arm / 2), lift, (depth - d) / 2, [arm, 560, depth], 80);
      }
    }

    // el puff: un módulo sin respaldo, pegado al frente del asiento, como una chaise que se puede correr
    if (v.ottoman) {
      const ow = Math.min(sw, 900);
      const cx = total * (v.chaise === "derecha" ? 0.28 : 0.72);
      // dónde termina el asiento delante del puff: en el curvo, el frente es un arco (se toma el punto más adelantado bajo el puff)
      let front = v.chaise === "no" ? d : d + 640;
      if (curved) {
        const rf = R - d / 2;
        front = 0;
        for (const x of [cx - ow / 2, cx, cx + ow / 2]) {
          const dx = Math.min(rf, Math.abs(x - total / 2));
          front = Math.max(front, d / 2 + R - Math.sqrt(rf * rf - dx * dx));
        }
      }
      const f = { cx, cz: front + 320 + 2, ry: 0 };
      if (bubbles) for (const [k, lx] of [-ow / 4, ow / 4].entries()) put(f, `ott:${k}`, "Puff", "shelf", "fabric", lx, lift, 0, [ow / 2 - 6, 400, 620], 150);
      else {
        put(f, "ott:base", "Base del puff", "bottom", "fabric", 0, lift, 0, [ow, 210, 640], 55);
        put(f, "ott:seat", "Almohadón del puff", "shelf", "fabric", 0, lift + 190, 0, [ow - 10, 180, 630], 85);
      }
      supports(f, "sup:ott", ow, 640);
    }

    // un almohadón de otro color, apoyado en el respaldo
    if (!bubbles) {
      const f = frame(0);
      put(f, "deco:throw", "Almohadón", "shelf", `tint:${fabricById(c.fabric).id === "grafito" ? "#c9bba4" : "#4a4f55"}`, -sw / 2 + 250, lift + 400, -d / 2 + 420, [420, 380, 150], 70, { decor: true });
    }
    return { parts, drawers: 0, doors: 0, gap: 160 };
  },
};

export type FurnitureBuild = { assembly: Assembly; parts: Part[]; doors: number; drawers: number };

export function buildFurniture(config: FurnitureConfig): FurnitureBuild {
  const { parts, drawers, doors, center, gap, wall } = BUILDERS[config.family](config.values, config);
  // lo que va en el medio del ambiente se separa de la pared; lo demás queda apoyado contra ella
  const shift = center ? ROOM_CENTER : (gap ?? 0);
  if (shift)
    for (const p of parts) {
      p.position = [p.position[0], p.position[1], p.position[2] + shift];
      // una pieza curva lleva su centro de arco con ella
      if (p.arc) p.arc = { ...p.arc, cz: p.arc.cz + shift };
    }
  const min: Vec3 = [Infinity, 0, Infinity];
  const max: Vec3 = [-Infinity, 0, -Infinity];
  const room = { min: [Infinity, 0, 0] as Vec3, max: [-Infinity, 0, -Infinity] as Vec3 };
  // las medidas son las del mueble: la alfombra o la tele no cuentan. La habitación sí las tiene en cuenta
  for (const p of parts) {
    if (p.kind === "glow") continue;
    // una pieza girada ocupa, en planta, el rectángulo que la envuelve
    const cos = Math.abs(Math.cos(p.rotationY ?? 0));
    const sin = Math.abs(Math.sin(p.rotationY ?? 0));
    const half: Vec3 = [(p.size[0] * cos + p.size[2] * sin) / 2, p.size[1] / 2, (p.size[0] * sin + p.size[2] * cos) / 2];
    for (let k = 0; k < 3; k++) {
      const center = p.position[k] + p.size[k] / 2;
      room.min[k] = Math.min(room.min[k], center - half[k]);
      room.max[k] = Math.max(room.max[k], center + half[k]);
      if (p.decor) continue;
      min[k] = Math.min(min[k], center - half[k]);
      max[k] = Math.max(max[k], center + half[k]);
    }
  }
  // aire a los costados: el mueble no queda encajonado entre dos paredes
  room.min[0] -= 700;
  room.max[0] += 700;
  room.min[1] = 0;
  min[1] = 0;
  const own = parts.filter((p) => !p.decor);
  const assembly: Assembly = {
    runs: [{ index: 0, rotationY: 0, offset: [0, 0, 0], span: max[0] - min[0], parts }],
    hardware: [],
    counts: { modules: 1, doors, drawers, angledCuts: 0, curvedCuts: 0 },
    ledMeters: own.filter((p) => p.kind === "led").reduce((m, p) => m + p.size[0] / 1000, 0),
    bounds: { min, max },
    room,
    walls: wall ? "back" : "none",
  };
  return { assembly, parts: own, doors, drawers };
}

// ------------------------------------------------------------------ precio y resumen

/** valores de muestra de lo que no sale de placa; como todo precio de la demo, hay que reemplazarlos */
const SAMPLE = { sofaModule: 520_000, sofaArm: 140_000, sofaChaise: 260_000, leg: 9_000, metalLeg: 22_000, ironPerMeter: 14_000, leatherPerModule: 310_000 };

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
    // el cuero cuesta más que la tela: un recargo de muestra por cuerpo
    if (fabricById(config.fabric).weave === "cuero") cost += (v.seats as number) * SAMPLE.leatherPerModule;
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
