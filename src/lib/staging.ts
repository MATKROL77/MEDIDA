/**
 * La puesta en escena de los otros muebles: lo que se apoya en una tapa, en un
 * estante o en el piso para ver el mueble en uso, armado como en una foto de
 * catálogo. Libros parados en grupos con alguno recostado, pilas acostadas con
 * algo encima, un jarrón, una planta, un cuadro apoyado, una notebook, cajas y
 * canastos, almohadones recostados, una manta, una alfombra.
 *
 * Todo es ambientación (`decor: true`): se dibuja, pero no entra en el
 * despiece ni en el precio, y se saca con un botón. Cada cosa se elige según
 * el lugar que hay (nada atraviesa el estante de arriba ni asoma del borde) y
 * sale siempre igual para el mismo mueble: no hay azar, hay una semilla.
 *
 * Las formas son las que el 3D ya sabe dibujar (cajas, cilindros, almohadones,
 * tapas en planta, los modelos escaneados y las cajas, canastos y mantas
 * dobladas del placard): acá solo se decide qué va y dónde, en mm.
 */

import type { Part, Vec3 } from "./assembly.ts";
import { DECOR_MODELS, type DecorModel } from "./decor-models.ts";

type Shape = Partial<Pick<Part, "geometry" | "radius" | "rotationY" | "rotationZ" | "wrinkle" | "puff" | "pinch" | "drape" | "plan" | "garment" | "model">>;

/** un número estable entre 0 y 1 a partir de una semilla y un índice */
export const rnd = (seed: number, k: number): number => {
  const v = Math.sin(seed * 127.1 + k * 311.7 + 0.5) * 43758.5453;
  return v - Math.floor(v);
};
const pick = <T>(list: readonly T[], r: number): T => list[Math.min(list.length - 1, Math.floor(r * list.length))];
/** un entero estable a partir de un texto: dos huecos con distinto nombre no salen iguales */
export const hash = (text: string): number => {
  let h = 7;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 99991;
  return h;
};

/** una cosa de la ambientación: una caja con su esquina mínima y su medida */
export function thing(id: string, label: string, material: string, position: Vec3, size: Vec3, shape: Shape = {}): Part {
  return { id, label, kind: "shelf", material, run: 0, module: null, position, size, geometry: "box", decor: true, cut: null, explode: [0, 0, 0], ...shape };
}

/**
 * Un objeto escaneado (public/models), apoyado en `y` y centrado en (cx, cz).
 * `scale` lo achica entero; nunca se deforma.
 */
export function scanned(id: string, label: string, model: DecorModel, cx: number, y: number, cz: number, scale = 1, turn = 0): Part {
  const [w, h, d] = DECOR_MODELS[model].map((v) => v * scale);
  return thing(id, label, "none", [cx - w / 2, y, cz - d / 2], [w, h, d], { geometry: "model", model, ...(turn ? { rotationY: turn } : {}) });
}

/** cuánto hay que achicar un modelo para que entre en un alto y un ancho (1 si entra entero) */
export const fit = (model: DecorModel, height: number, width = Infinity): number => Math.min(1, height / DECOR_MODELS[model][1], width / DECOR_MODELS[model][0]);

/**
 * Una placa parada que mira al frente y se recuesta hacia atrás `lean`
 * radianes: la pantalla de una notebook, un cuadro apoyado, un almohadón
 * contra el respaldo. `center` es su centro; `w` a lo ancho, `h` a lo alto y
 * `t` de espesor. (La pieza se arma acostada y se gira: el 3D solo gira sobre
 * el eje vertical y el del frente.)
 */
export function leaned(id: string, label: string, material: string, center: Vec3, w: number, h: number, t: number, lean: number, shape: Shape = {}): Part {
  return thing(id, label, material, [center[0] - h / 2, center[1] - t / 2, center[2] - w / 2], [h, t, w], { rotationZ: Math.PI / 2 - lean, rotationY: Math.PI / 2, ...shape });
}

/**
 * El centro de una placa recostada que apoya su canto de abajo y atrás en
 * (y, zb): de ahí sube y se va hacia atrás.
 */
const restOn = (cx: number, y: number, zb: number, h: number, t: number, lean: number): Vec3 => [cx, y + (h / 2) * Math.cos(lean) + (t / 2) * Math.sin(lean), zb - (h / 2) * Math.sin(lean) + (t / 2) * Math.cos(lean)];

// ---------------------------------------------------------------- libros

/** lomos de catálogo: muchos claros y neutros, y algún color apagado */
const SPINES = ["#ece7dc", "#d9d2c4", "#f3efe7", "#c9baa0", "#a9a79e", "#9aa59b", "#6f8090", "#b98a6c", "#8c705b", "#414c57", "#c7a85a", "#7f9080", "#d8c9b4", "#5c5f63"];

/**
 * Libros parados, lomo al frente, desde `x` hacia la derecha hasta ocupar
 * `width` como mucho. Van de a tandas de la misma colección (mismo alto,
 * tonos parecidos); `lean` recuesta uno contra la punta ("end") o el arranque
 * ("start") de la hilera. `back` y `front`: de dónde a dónde puede ir un
 * libro en profundidad. Devuelve también dónde termina la hilera.
 */
export function bookRow(id: string, x: number, y: number, back: number, front: number, width: number, height: number, seed: number, lean: "start" | "end" | null = "end"): { parts: Part[]; end: number } {
  const parts: Part[] = [];
  const tall = Math.min(300, height - 14);
  if (tall < 150 || front - back < 90 || width < 60) return { parts, end: x };
  const tilt = 0.2;
  // el recostado: su alto y su espesor, y cuánto lugar ocupa a lo ancho
  const lt = 24 + Math.round(rnd(seed, 90) * 14);
  let lh = Math.min(tall - 10, 200 + Math.round(rnd(seed, 91) * 50));
  const leanWidth = () => lt * Math.cos(tilt) + lh * Math.sin(tilt);
  const book = (k: number, bx: number, t: number, h: number, shape: Shape = {}, by = y) => {
    const d = Math.min(front - back, Math.round(h * (0.66 + 0.1 * rnd(seed, 40 + k))));
    parts.push(thing(`${id}:${k}`, "Libro", `tint:${pick(SPINES, rnd(seed, 60 + k))}`, [bx, by, Math.max(back, front - d - Math.round(6 * rnd(seed, 50 + k)))], [t, h, d], shape));
  };
  // el lugar que se le guarda al recostado delante de la hilera
  const lead = lean === "start" ? leanWidth() + 1 : 0;
  let cx = x + lead;
  const limit = x + width - (lean === "end" ? leanWidth() + 1 : 0);
  let first = 0;
  let last = 0;
  let k = 0;
  let h = 0;
  let left = 0;
  while (k < 10) {
    if (left === 0) {
      // otra colección: dos o tres del mismo alto
      left = 1 + Math.floor(rnd(seed, 10 + k) * 3);
      h = Math.min(tall, 180 + Math.round(rnd(seed, 20 + k) * 11) * 10);
    }
    const t = 20 + Math.round(rnd(seed, 30 + k) * 24);
    if (cx + t > limit) break;
    book(k, cx, t, h);
    if (k === 0) first = h;
    last = h;
    cx += t + 1;
    left--;
    k++;
  }
  if (k === 0) return { parts: [], end: x };
  if (lean) {
    // se apoya en el canto de abajo y toca al vecino con la punta de arriba: no puede ser más alto que él
    lh = Math.min(lh, Math.floor(((lean === "end" ? last : first) - 6 - lt * Math.sin(tilt)) / Math.cos(tilt)));
    if (lh >= 150) {
      const half = (lt / 2) * Math.cos(tilt) + (lh / 2) * Math.sin(tilt);
      // contra la punta de la hilera, o contra su arranque (queda donde lo deje el alto del vecino)
      const mx = lean === "end" ? cx + half : x + lead - 1 - half;
      const my = y + (lt / 2) * Math.sin(tilt) + (lh / 2) * Math.cos(tilt);
      book(99, mx - lt / 2, lt, lh, { rotationZ: lean === "end" ? tilt : -tilt }, my - lh / 2);
      if (lean === "end") cx += 2 * half + 1;
    }
  }
  return { parts, end: cx };
}

/**
 * Una pila de libros acostados, centrada en (cx, cz): los más grandes abajo,
 * cada uno apenas girado. Devuelve la altura a la que queda la tapa del de arriba.
 */
export function bookStack(id: string, cx: number, y: number, cz: number, n: number, seed: number, size = 1): { parts: Part[]; top: number } {
  const parts: Part[] = [];
  let top = y;
  for (let k = 0; k < n; k++) {
    const len = Math.round((290 - 22 * k - 30 * rnd(seed, k)) * size);
    const wide = Math.round((210 - 12 * k - 20 * rnd(seed, 10 + k)) * size);
    const t = Math.round(22 + 16 * rnd(seed, 20 + k));
    const turn = (rnd(seed, 30 + k) - 0.5) * 0.3;
    parts.push(thing(`${id}:${k}`, "Libro", `tint:${pick(SPINES, rnd(seed, 40 + k))}`, [cx - len / 2 + (rnd(seed, 50 + k) - 0.5) * 14, top, cz - wide / 2], [len, t, wide], { rotationY: turn }));
    top += t;
  }
  return { parts, top };
}

// ---------------------------------------------------------------- objetos

/** una vela gruesa sobre su platito */
export function candle(id: string, cx: number, y: number, cz: number, h = 90): Part[] {
  return [
    thing(`${id}:plato`, "Vela", "gloss:#b9a27c", [cx - 48, y, cz - 48], [96, 6, 96], { geometry: "cyl" }),
    thing(`${id}:vela`, "Vela", "tint:#f1ebdd", [cx - 34, y + 6, cz - 34], [68, h, 68], { geometry: "cyl" }),
  ];
}

/** una taza */
export const mug = (id: string, cx: number, y: number, cz: number, color = "#ebe6dc"): Part => thing(id, "Taza", `tint:${color}`, [cx - 41, y, cz - 41], [82, 92, 82], { geometry: "cyl" });

/** un portalápices con dos lápices asomando */
export function pencils(id: string, cx: number, y: number, cz: number): Part[] {
  return [
    thing(`${id}:vaso`, "Portalápices", "tint:#3d4247", [cx - 40, y, cz - 40], [80, 105, 80], { geometry: "cyl" }),
    thing(`${id}:a`, "Lápiz", "tint:#c7a85a", [cx - 16, y + 30, cz - 6], [8, 150, 8], { geometry: "cyl", rotationZ: 0.16 }),
    thing(`${id}:b`, "Lápiz", "tint:#ece7dc", [cx + 8, y + 26, cz + 4], [8, 150, 8], { geometry: "cyl", rotationZ: -0.2 }),
  ];
}

const PRINTS = ["#b9a58c", "#8fa3a0", "#c98f6f", "#5f6f7c", "#a7ad94", "#d2b47a"];
const FRAMES = ["tint:#2b2b2c", "veneer:#b08d62", "tint:#f1ede6"];

/**
 * Un cuadro apoyado, recostado contra el fondo: el marco, el paspartú y una
 * lámina lisa. `wall` es la cara contra la que se recuesta (la toca con el
 * canto de arriba; el de abajo queda un poco adelante); `w` × `h` es el marco.
 */
export function frame(id: string, cx: number, y: number, wall: number, w: number, h: number, seed: number): Part[] {
  const lean = 0.12;
  const t = 16;
  const c = restOn(cx, y, wall + h * Math.sin(lean), h, t, lean);
  // hacia dónde mira la cara de adelante
  const n: Vec3 = [0, Math.sin(lean), Math.cos(lean)];
  const at = (k: number): Vec3 => [c[0] + n[0] * k, c[1] + n[1] * k, c[2] + n[2] * k];
  const mat = Math.min(w, h) * 0.2;
  return [
    leaned(`${id}:marco`, "Cuadro", pick(FRAMES, rnd(seed, 1)), c, w, h, t, lean),
    leaned(`${id}:paspartu`, "Cuadro", "tint:#f4f1ea", at(t / 2 + 0.4), w - 22, h - 22, 1.2, lean),
    leaned(`${id}:lamina`, "Cuadro", `tint:${pick(PRINTS, rnd(seed, 2))}`, at(t / 2 + 1.4), w - 22 - 2 * mat, h - 22 - 2 * mat, 1, lean),
  ];
}

/**
 * Una notebook abierta mirando al frente: la base, el teclado, la tapa
 * recostada y la pantalla. (cx, cz) es el centro de la base.
 */
export function laptop(id: string, cx: number, y: number, cz: number): Part[] {
  const [w, d, t] = [330, 228, 14];
  const lean = 0.3;
  const h = 216;
  const lid = restOn(cx, y + t - 3, cz - d / 2 + 2, h, 6, lean);
  const n: Vec3 = [0, Math.sin(lean), Math.cos(lean)];
  return [
    thing(`${id}:base`, "Notebook", "tint:#b4b7ba", [cx - w / 2, y, cz - d / 2], [w, t, d]),
    thing(`${id}:teclas`, "Notebook", "tint:#2c2e31", [cx - w / 2 + 22, y + t, cz - d / 2 + 26], [w - 44, 1, 104]),
    thing(`${id}:pad`, "Notebook", "tint:#a5a8ab", [cx - 52, y + t, cz + d / 2 - 82], [104, 0.8, 66]),
    leaned(`${id}:tapa`, "Notebook", "tint:#b4b7ba", lid, w, h, 6, lean),
    leaned(`${id}:pantalla`, "Notebook", "gloss:#14171b", [lid[0] + n[0] * 3.4, lid[1] + n[1] * 3.4, lid[2] + n[2] * 3.4], w - 16, h - 18, 0.8, lean),
  ];
}

/** una bandeja de madera oscura, de cantos redondeados, centrada en (cx, cz) */
export const tray = (id: string, cx: number, y: number, cz: number, w: number, d: number): Part =>
  thing(id, "Bandeja", "veneer:#4a3526", [cx - w / 2, y, cz - d / 2], [w, 14, d], { plan: { corners: [26, 26, 26, 26] } });

const BOXES = [["#eeeae2", "#8f8a80"], ["#d3ccbe", "#7a5a40"], ["#b9b4aa", "#f4f2ee"], ["#5d6066", "#c9c5bc"]];
/** una caja de tela para guardar (la misma forma que las del placard), con su esquina en (x, y, z) */
export const storageBox = (id: string, x: number, y: number, z: number, size: Vec3, seed: number): Part =>
  thing(id, "Caja", "paint:#ffffff", [x, y, z], size, { geometry: "garment", garment: { shape: "box", variant: Math.floor(rnd(seed, 3) * 2), colors: pick(BOXES, rnd(seed, 4)) } });

const FIBERS = ["#c2a374", "#a98a5c", "#d4c19c"];
/** un canasto de fibra, centrado en (cx, cz) */
export const basket = (id: string, cx: number, y: number, cz: number, size: Vec3, seed: number): Part =>
  thing(id, "Canasto", "paint:#ffffff", [cx - size[0] / 2, y, cz - size[2] / 2], size, { geometry: "garment", garment: { shape: "basket", variant: Math.floor(rnd(seed, 5) * 3), colors: [pick(FIBERS, rnd(seed, 6))] } });

/** una manta de lana doblada, con el doblez al frente, centrada en (cx, cz) */
export const foldedThrow = (id: string, cx: number, y: number, cz: number, color: string, size: Vec3 = [330, 74, 400], turn = 0): Part =>
  thing(id, "Manta doblada", `cloth:lana:${color}`, [cx - size[0] / 2, y, cz - size[2] / 2], size, { geometry: "garment", garment: { shape: "folded", variant: 9 }, ...(turn ? { rotationY: turn } : {}) });

/**
 * Un almohadón de adorno recostado hacia atrás, de lino y relleno de pluma:
 * fino en el borde, con las puntas pellizcadas. Apoya su canto de atrás en (y, zb).
 */
export function cushion(id: string, color: string, cx: number, y: number, zb: number, w: number, h: number, lean: number, t = 150): Part {
  return leaned(id, "Almohadón", `linen:${color}`, restOn(cx, y, zb, h, t, lean), w, h, t, lean, { geometry: "cushion", radius: 42, pinch: 0.18, wrinkle: 4 });
}

/** una alfombra de lana al piso, con las esquinas redondeadas (o redonda), desde (x, z) */
export function rug(id: string, x: number, z: number, w: number, d: number, color: string, round = false): Part {
  const p = thing(id, "Alfombra", `rug:${color}`, [x, 0, z], [w, 9, d], { plan: round ? { ellipse: true } : { corners: [70, 70, 70, 70] } });
  p.kind = "bottom";
  return p;
}

/** el tono de alfombra que acompaña a un color (el de la tela o el de la madera) sin copiarlo */
export function rugFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const light = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return light > 0.62 ? "#b9b2a6" : light > 0.36 ? "#d6cfc2" : "#cfc8bb";
}

/** los dos tonos de almohadón que van con una tela: uno que contrasta y uno de acento */
export function cushionsFor(hex: string): [string, string] {
  const n = parseInt(hex.slice(1), 16);
  const light = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return light > 0.62 ? ["#4c5660", "#96705a"] : light > 0.36 ? ["#e4dccb", "#3f4650"] : ["#ddd4c2", "#b3905a"];
}

// ---------------------------------------------------------------- estantes

/** un hueco de estante: su esquina de atrás, abajo y a la izquierda, el ancho, el alto libre y el fondo útil */
export type Cell = { x: number; y: number; z: number; w: number; h: number; d: number };

/**
 * Un objeto, elegido entre los que entran parados en el alto, el ancho y el
 * fondo que hay; `turn` dice cuál toca (se van turnando: no sale siempre el
 * mismo). `back`: hasta dónde puede recostarse un cuadro. `solo`: va solo en
 * su lugar, así que lleva algo chico al lado para no quedar perdido.
 */
function accent(id: string, cx: number, y: number, at: number, back: number, height: number, width: number, depth: number, turn: number, solo = false): Part[] {
  const room = height - 18;
  const options: (() => Part[])[] = [];
  // en profundidad, donde se pide o lo más cerca que entre sin asomar del estante ni meterse en el fondo
  const inside = (size: number, want = at) => Math.min(back + depth - size / 2 - 2, Math.max(back + size / 2 + 2, want));
  const add = (model: DecorModel, label: string, least: number, scale = 1) => {
    const [mw, mh, md] = DECOR_MODELS[model];
    const k = Math.min(scale, room / mh, width / mw, (depth - 6) / md);
    if (k < least * scale) return;
    const cz = inside(md * k);
    options.push(() => {
      const out = [scanned(`${id}:${model}`, label, model, cx, y, cz, k)];
      // al lado y un poco adelante, algo bajo que lo acompañe
      const side = cx + (mw * k) / 2 + 75;
      if (solo && model !== "cuenco" && width >= mw * k + 260 && depth >= 150) out.push(...(model === "suculenta" ? [scanned(`${id}:bronce`, "Jarrón", "jarron-bronce", side, y, inside(61, cz - 20), Math.min(1, room / 170))] : candle(`${id}:vela`, side, y, inside(96, cz + 25), Math.min(80, room - 20))));
      return out;
    });
  };
  add("suculenta", "Suculenta", 0.7);
  add("jarron", "Jarrón", 0.62, 0.72);
  if (room >= 260 && width >= 240 && depth >= 110) options.push(() => frame(id, cx, y, back + 4, 200, 250, turn));
  add("jarron-alto", "Jarrón", 0.8, 0.8);
  if (solo) add("cuenco", "Cuenco", 0.6, 0.8);
  if (room >= 215 && width >= 300 && depth >= 110) options.push(() => frame(id, cx, y, back + 4, 260, 200, turn + 3));
  if (!options.length) return room >= 70 && width >= 100 && depth >= 104 ? candle(id, cx, y, inside(96), Math.min(110, room - 12)) : [];
  return options[Math.abs(Math.round(turn)) % options.length]();
}

/** lo que corona una pila de libros acostados: por turno, un jarroncito, una vela, un cuenco chico o nada */
function topping(id: string, cx: number, y: number, cz: number, height: number, span: number, turn: number): Part[] {
  const kind = Math.abs(Math.round(turn)) % 4;
  if (kind === 0 && height >= 190 && span >= 90) return [scanned(`${id}:bronce`, "Jarrón", "jarron-bronce", cx, y, cz)];
  if (kind === 1 && height >= 100 && span >= 104) return candle(id, cx, y, cz, Math.min(90, height - 30));
  if (kind === 2 && height >= 80 && span >= 120) return [scanned(`${id}:cuenco`, "Cuenco", "cuenco", cx, y, cz, Math.min(0.5, (span * 0.92) / 313))];
  return [];
}

/**
 * Lo que va en un hueco de estante. `full`: un hueco de biblioteca, con una
 * hilera de libros y algo al lado; si no, liviano: un objeto, una pila con
 * algo encima, un par de cajas. En un hueco bajo, lo que entra acostado.
 */
export function shelfScene(id: string, cell: Cell, seed: number, full: boolean): Part[] {
  const { x, y, z, w, h, d } = cell;
  const out: Part[] = [];
  if (w < 120 || h < 60 || d < 110) return out;
  const front = z + Math.min(d - 12, 250);
  const cz = z + Math.min(d, 280) / 2 + 6;
  // qué composición toca y, dentro de ella, qué objeto: se van turnando con la semilla
  const kind = Math.abs(Math.round(seed)) % 4;
  const turn = Math.floor(Math.abs(Math.round(seed)) / 4);
  // una pila acostada, centrada donde se pide o lo más cerca que entre (apenas girados, ocupan un poco más que su medida)
  const stackAt = (at: number, n: number, tag: string, crowned: boolean, from = x) => {
    const size = Math.min(1, (d - 10) / 256, (x + w - from - 8) / 332);
    if (size < 0.55) return;
    const cx = Math.min(x + w - 166 * size - 3, Math.max(from + 166 * size + 3, at));
    const s = bookStack(`${id}:${tag}`, cx, y, z + Math.max((256 * size) / 2 + 2, Math.min(d, 280) / 2 + 6), Math.min(n, Math.floor((h - 20) / 38)), seed + 11, size);
    out.push(...s.parts);
    const last = s.parts[s.parts.length - 1];
    // lo de arriba no puede ser más grande que el libro en el que apoya
    if (crowned && last) out.push(...topping(`${id}:${tag}:o`, cx, s.top, last.position[2] + last.size[2] / 2, h - (s.top - y), Math.min(last.size[0], last.size[2]) - 14, turn));
  };
  if (h < 175) {
    // bajo: una pila acostada y, si hay lugar, un cuenco
    if (w >= 640 && h >= 115) {
      stackAt(x + w * 0.27, 2, "p", false);
      out.push(scanned(`${id}:cuenco`, "Cuenco", "cuenco", x + w * 0.7, y, cz, Math.min(0.85, (d - 20) / 309)));
    } else stackAt(x + w / 2 + (rnd(seed, 2) - 0.5) * w * 0.2, 3, "p", false);
    return out;
  }
  if (full) {
    if (kind === 0 && w >= 420) {
      // una hilera a la izquierda con uno recostado, y algo solo a la derecha
      const row = bookRow(`${id}:l`, x + 6, y, z, front, w * 0.52, h, seed, "end");
      out.push(...row.parts, ...accent(`${id}:o`, (row.end + x + w) / 2 + 10, y, cz, z, h, x + w - row.end - 50, d, turn));
    } else if (kind === 1 && w >= 420) {
      // al revés: el objeto a la izquierda y la hilera contra el lateral derecho
      const from = x + w * 0.46;
      out.push(...bookRow(`${id}:l`, from, y, z, front, x + w - 6 - from, h, seed, "start").parts, ...accent(`${id}:o`, x + w * 0.22, y, cz, z, h, w * 0.36, d, turn));
    } else if (kind === 2 && w >= 480) {
      // una hilera corta y una pila acostada con algo encima
      const row = bookRow(`${id}:l`, x + 6, y, z, front, w * 0.4, h, seed, null);
      out.push(...row.parts);
      stackAt(x + w * 0.72, 3, "p", true, row.end + 12);
    } else {
      // la hilera sola, con uno recostado al final
      out.push(...bookRow(`${id}:l`, x + 6, y, z, front, Math.min(w - 12, Math.max(w * 0.7, 260)), h, seed, w >= 300 ? "end" : null).parts);
    }
    return out;
  }
  if (kind === 0 && w >= 480 && h >= 230) {
    // dos cajas de tela, una al lado de la otra
    const bw = Math.min(300, (w - 60) / 2);
    const bh = Math.min(230, h - 40);
    const bd = Math.min(260, d - 20);
    const x0 = x + (w - 2 * bw - 24) / 2;
    for (let k = 0; k < 2; k++) out.push(storageBox(`${id}:caja${k}`, x0 + k * (bw + 24), y, z + Math.max(8, d - bd - 30), [bw, bh, bd], seed));
  } else if (kind === 1 && w >= 300) {
    stackAt(x + w * (0.36 + 0.3 * rnd(seed, 3)), 3, "p", true);
  } else if (kind === 2 && w >= 420 && h >= 180) {
    // un cuadro apoyado y algo chico delante, corrido
    const tall = h >= 300;
    const fh = tall ? 260 : Math.min(200, h - 30);
    const fw = tall ? 210 : Math.min(270, w - 80);
    out.push(...frame(`${id}:cuadro`, x + w * 0.4, y, z + 4, fw, fh, seed), ...accent(`${id}:o`, x + w * 0.4 + fw / 2 + 80, y, cz + 20, z, Math.min(h, 215), w * 0.6 - fw / 2 - 100, d, turn + 1));
  } else out.push(...accent(`${id}:o`, x + w * (0.38 + 0.16 * rnd(seed, 4)), y, cz, z, h, w * 0.56, d, turn, true));
  return out;
}

// ---------------------------------------------------------------- tapas

/** una lámpara de mesa: pie de cerámica (escaneado), cuello de bronce y pantalla de lino abierta. `shade`: diámetro de la pantalla */
export function lamp(id: string, cx: number, y: number, cz: number, shade = 300): Part[] {
  const base = scanned(`${id}:base`, "Lámpara", "jarron", cx, y, cz, 0.55);
  const bh = base.size[1];
  return [
    base,
    thing(`${id}:neck`, "Lámpara", "gloss:#b9a27c", [cx - 8, y + bh - 6, cz - 8], [16, 80, 16], { geometry: "cyl" }),
    thing(`${id}:shade`, "Lámpara", "linen:#efe7d8", [cx - shade / 2, y + bh + 40, cz - shade / 2], [shade, shade * 0.7, shade], { geometry: "shade" }),
  ];
}

/**
 * Sobre una tapa de `w` × `d` (con el frente hacia +z): dónde cae un punto
 * dado de -1 a 1 en cada sentido, dejando un margen al borde. En una tapa
 * redonda todo se junta hacia el centro para no asomar de la curva.
 */
const spot = (w: number, d: number, round: boolean, margin = 150) => (u: number, v: number): [number, number] => {
  const k = round ? 0.56 : 1;
  return [w / 2 + u * Math.max(0, w / 2 - margin) * k, d / 2 + v * Math.max(0, d / 2 - margin) * k];
};

/** un escritorio en uso: la notebook al frente, la lámpara en una punta, unos libros con una taza y los lápices */
export function deskScene(w: number, d: number, y: number, round: boolean): Part[] {
  const at = spot(w, d, round);
  const out: Part[] = [];
  const [lx, lz] = at(w >= 1000 ? -0.05 : 0, 1);
  const lapZ = Math.min(lz, d - 70) - 114 + (round ? 0 : 40);
  out.push(...laptop("deco:notebook", lx, y, lapZ));
  if (w >= 760 && d >= 560) {
    const [px, pz] = at(0.92, -0.75);
    out.push(...lamp("deco:lamp", Math.min(px, w - 170), y, Math.max(pz, 165)));
  }
  if (w >= 1000) out.push(mug("deco:taza", lx + 245, y, lapZ + 20, "#5d6b76"));
  if (w >= 1150 && d >= 560) {
    const [bx, bz] = at(-0.82, -0.35);
    const stack = bookStack("deco:libros", Math.max(bx, 200), y, Math.max(bz, 150), 3, 4, 0.92);
    out.push(...stack.parts, ...pencils("deco:lapices", Math.max(bx, 200) + 235, y, Math.max(bz, 150) - 40));
  }
  if (w >= 1500 && d >= 650) {
    const [sx, sz] = at(-0.2, -0.8);
    out.push(scanned("deco:planta", "Suculenta", "suculenta", sx, y, Math.max(sz, 150), 0.8));
  }
  return out;
}

/** una mesa de comedor puesta para la foto: un camino de lino, un jarrón, un cuenco y un par de velas */
export function diningScene(w: number, d: number, y: number, round: boolean): Part[] {
  const out: Part[] = [];
  const small = w < 1100 || d < 700;
  let top = y;
  if (!round && !small) {
    const rw = Math.min(w - 520, 1500);
    const rd = Math.min(380, d - 320);
    out.push(thing("deco:camino", "Camino de mesa", "linen:#d8cfbf", [w / 2 - rw / 2, y, d / 2 - rd / 2], [rw, 2.5, rd]));
    top = y + 2.5;
  }
  if (small) {
    out.push(scanned("deco:top:jarron", "Jarrón", "jarron", w / 2, top, d / 2, 0.72));
    return out;
  }
  out.push(scanned("deco:top:jarron", "Jarrón", "jarron-antiguo", w / 2 - (round ? 60 : 170), top, d / 2 - (round ? 40 : 10)), scanned("deco:top:cuenco", "Cuenco", "cuenco", w / 2 + (round ? 190 : 185), top, d / 2 + (round ? 60 : 10)));
  if (!round && w >= 1700) out.push(...candle("deco:vela0", w / 2 - 520, top, d / 2 + 30, 120), ...candle("deco:vela1", w / 2 - 420, top, d / 2 - 50, 80));
  return out;
}

/** una ratona de living: unos libros grandes con una vela encima y una bandeja con un jarrón */
export function coffeeScene(w: number, d: number, y: number, round = false): Part[] {
  const at = spot(w, d, round, 120);
  const out: Part[] = [];
  if (w >= 900 && d >= 440) {
    const [bx, bz] = at(-0.52, 0.05);
    const stack = bookStack("deco:top:libros", bx, y, bz, 2, 9, Math.min(1.08, (d - 120) / 215));
    out.push(...stack.parts, ...candle("deco:top:vela", bx - 20, stack.top, bz, 70));
    const [tx, tz] = at(0.45, 0);
    const tw = Math.min(400, w * 0.32);
    const td = Math.min(270, d - 160);
    out.push(tray("deco:top:bandeja", tx, y, tz, tw, td), scanned("deco:top:jarron", "Jarrón", "jarron", tx - tw * 0.2, y + 14, tz - td * 0.12, 0.62), scanned("deco:top:cuenco", "Cuenco", "cuenco", tx + tw * 0.2, y + 14, tz + td * 0.12, Math.min(0.5, (td - 40) / 309)));
  } else if (w >= 560 && d >= 360) {
    const [tx, tz] = at(0.1, 0);
    const tw = Math.min(340, w - 200);
    const td = Math.min(240, d - 140);
    out.push(tray("deco:top:bandeja", tx, y, tz, tw, td), scanned("deco:top:jarron", "Jarrón", "jarron", tx - tw * 0.18, y + 14, tz - 10, 0.6), ...candle("deco:top:vela", tx + tw * 0.2, y + 14, tz + 20, 70));
  } else out.push(scanned("deco:top:jarron", "Jarrón", "jarron", w / 2, y, d / 2, 0.6));
  return out;
}

/** lo que se guarda bajo una ratona: unas revistas apiladas y un canasto, en el estante de abajo */
export function underScene(cell: Cell): Part[] {
  const { x, y, z, w, h, d } = cell;
  const out: Part[] = [];
  if (w < 400 || h < 90 || d < 240) return out;
  const cz = z + d / 2;
  out.push(...bookStack("deco:bajo:libros", x + w * 0.27, y, cz, Math.min(3, Math.floor((h - 20) / 38)), 21, Math.min(1, (d - 40) / 215)).parts);
  if (w >= 760 && h >= 150) out.push(basket("deco:bajo:canasto", x + w * 0.72, y, cz, [Math.min(340, w * 0.3), Math.min(200, h - 40), Math.min(280, d - 60)], 2));
  return out;
}

/** una mesa de luz: el velador, un par de libros y una vela */
export function bedsideScene(w: number, d: number, y: number): Part[] {
  const out: Part[] = [];
  const roomy = w >= 470 && d >= 340;
  const shade = Math.min(260, d - 40);
  out.push(...lamp("deco:lamp", roomy ? Math.max(shade / 2 + 10, w * 0.3) : w / 2, y, Math.max(shade / 2 + 10, d * 0.42), shade));
  if (roomy) {
    const cx = Math.min(w - 115, w * 0.75);
    const stack = bookStack("deco:libros", cx, y, d * 0.6, 2, 6, Math.min(0.74, (w * 0.42) / 290));
    out.push(...stack.parts);
    if (w >= 520) out.push(mug("deco:taza", cx + 10, stack.top, d * 0.6 + 8, "#d9d2c4"));
  }
  return out;
}

/** un parlante de tela (una barra de sonido si es ancho), apoyado con su esquina en (x, y, z) */
export function speaker(id: string, x: number, y: number, z: number, size: Vec3): Part[] {
  return [thing(id, "Barra de sonido", "linen:#3a3b3d", [x, y, z], size, { geometry: "cushion", radius: Math.min(22, size[1] / 2 - 2) })];
}

/** una consola de juegos: una caja blanca baja sobre su base oscura, centrada en (cx, cz) */
export function consoleBox(id: string, cx: number, y: number, cz: number, depth: number): Part[] {
  const d = Math.min(210, depth);
  return [
    thing(`${id}:base`, "Consola", "tint:#1f2022", [cx - 132, y, cz - d / 2 + 8], [264, 12, d - 16]),
    thing(`${id}:cuerpo`, "Consola", "tint:#ebe8e2", [cx - 145, y + 12, cz - d / 2], [290, 46, d], { geometry: "cushion", radius: 9 }),
  ];
}

/**
 * Arriba de un mueble de TV de `w` × `d` (contra la pared, en z = 0): la
 * barra de sonido al centro, un grupo de jarrones y libros en una punta y una
 * planta con un cuadro en la otra. `inset`: cuánto hay que meterse desde cada
 * punta (las esquinas curvas).
 */
export function tvTopScene(w: number, d: number, y: number, inset: number, barWidth: number): Part[] {
  const out: Part[] = [];
  const cz = d * 0.5;
  out.push(...speaker("deco:sound", (w - barWidth) / 2, y, Math.min(60, d * 0.16), [barWidth, 68, 96]));
  // lo que queda libre a cada lado de la barra
  const side = (w - barWidth) / 2 - inset - 40;
  const x0 = inset + 30;
  if (side >= 380) {
    const stack = bookStack("deco:top:libros", x0 + 250, y, cz, 2, 13, Math.min(0.95, (d - 90) / 215));
    out.push(scanned("deco:top:jarron", "Jarrón", "jarron", x0 + 70, y, cz - 30, 0.65), ...stack.parts, scanned("deco:top:bronce", "Jarrón", "jarron-bronce", x0 + 255, stack.top, cz));
    out.push(scanned("deco:top:planta", "Suculenta", "suculenta", w - x0 - 265, y, cz + 30), ...frame("deco:top:cuadro", w - x0 - 150, y, 6, 200, 250, 5));
  } else if (side >= 170) {
    out.push(scanned("deco:top:jarron", "Jarrón", "jarron", x0 + 70, y, cz, 0.7), scanned("deco:top:planta", "Suculenta", "suculenta", w - x0 - 80, y, cz, 0.85));
  } else if (side >= 90) out.push(scanned("deco:top:bronce", "Jarrón", "jarron-bronce", x0 + 30, y, cz));
  return out;
}

/** un nicho bajo de un mueble de TV (el que queda sobre los cajones): por turno, libros acostados, la consola, un cuenco */
export function nicheScene(id: string, cell: Cell, turn: number): Part[] {
  const { x, y, z, w, h, d } = cell;
  if (w < 320 || h < 90 || d < 200) return [];
  const cx = x + w / 2;
  const cz = z + d * 0.52;
  const kind = turn % 3;
  if (kind === 0) return bookStack(`${id}:libros`, cx - w * 0.1, y, cz, Math.min(3, Math.floor((h - 24) / 38)), 30 + turn, Math.min(0.95, (d - 60) / 215)).parts;
  if (kind === 1) return consoleBox(`${id}:consola`, cx, y, cz, d - 80);
  const k = Math.min(0.8, (h - 24) / 94, (d - 60) / 309, (w - 60) / 313);
  return k >= 0.5 ? [scanned(`${id}:cuenco`, "Cuenco", "cuenco", cx + w * 0.08, y, cz, k)] : [];
}
