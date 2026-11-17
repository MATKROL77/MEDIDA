/**
 * Lo que acompaña a un mueble para verlo en uso. En un placard: la ropa
 * colgada, cada prenda en su percha; pilas de ropa doblada; calzado; cajas y
 * canastos de guardado. No son piezas: se dibujan, pero no entran en el
 * despiece ni en el precio, y se pueden sacar con un botón.
 *
 * Acá se decide qué va y dónde (con sus medidas, para que nada atraviese un
 * estante ni quede flotando); la forma de cada cosa está en
 * `components/viewer/garments.ts`.
 */

import { toWorld, type Assembly, type GarmentShape, type Part, type RunAssembly } from "./assembly.ts";

/**
 * La percha, en mm: de la punta del gancho al centro del barral, de ahí a
 * donde nacen los brazos (el "cuello"), cuánto caen los brazos hasta la punta,
 * su alto, a qué altura va la varilla (las de pantalón) y sus medidas.
 */
export const HANGER = { hookTop: 17, neck: 46, drop: 62, arm: 24, bar: 76, width: 420, thick: 14 } as const;
export const HANGER_HEIGHT = HANGER.hookTop + HANGER.neck + HANGER.drop + HANGER.arm;

export type HungShape = "shirt" | "tee" | "sweater" | "jacket" | "coat" | "dress" | "pants";

/**
 * Las prendas que se cuelgan. `t`, el grosor (a lo largo del barral); `w`, el
 * ancho de hombros con las mangas; `out`, cuánto sale la manga de cada hombro;
 * `len`, el largo de cada variante, del tope del cuello al ruedo; `rise`,
 * cuánto sube el cuello sobre el nacimiento de los brazos de la percha;
 * `hanger`, qué percha lleva (0 de madera, 1 fina negra, 2 de madera con varilla).
 */
export const HUNG: Record<HungShape, { t: number; w: number; out: number; len: number[]; rise: number; hanger: number; weave: string; colors: string[] }> = {
  shirt: { t: 54, w: 476, out: 18, len: [770, 750, 790], rise: 34, hanger: 0, weave: "algodon", colors: ["#f4f2ee", "#cdd9e6", "#e8e2d6", "#9db0c4", "#f4f2ee", "#d9dccf", "#e6cfc8"] },
  tee: { t: 44, w: 540, out: 52, len: [690, 670, 710], rise: 10, hanger: 1, weave: "jersey", colors: ["#f1efea", "#8d9a89", "#c4b196", "#5b7186", "#b96a58", "#d5cfc3", "#7e8fa0", "#4b4d52"] },
  sweater: { t: 74, w: 500, out: 24, len: [680, 700, 660], rise: 14, hanger: 0, weave: "lana", colors: ["#ddd7cb", "#6e8496", "#a08468", "#5c6b5e", "#b96a58", "#bdb8ae", "#4a505c"] },
  jacket: { t: 88, w: 492, out: 22, len: [770, 790, 750], rise: 36, hanger: 0, weave: "pano", colors: ["#465a74", "#4e5157", "#857f75", "#a08468", "#5f6b76"] },
  coat: { t: 100, w: 500, out: 24, len: [1130, 1190, 1080], rise: 36, hanger: 0, weave: "pano", colors: ["#c4b196", "#55585e", "#8b9084", "#7a6453"] },
  dress: { t: 58, w: 440, out: 25, len: [1160, 1240, 1100], rise: 0, hanger: 1, weave: "jersey", colors: ["#465a74", "#b96a58", "#dccfb8", "#4b4d52", "#8d9a89"] },
  pants: { t: 58, w: 330, out: 0, len: [545, 570, 520], rise: 23 - 2 - HANGER.bar, hanger: 2, weave: "jean", colors: ["#506b8c", "#35435e", "#c4b196", "#7b7f72", "#4b4d52", "#a08468", "#6a86a6"] },
};

/** la ropa doblada: remeras, jeans y buzos (ancho, alto de cada una y fondo, en mm) */
const FOLDED: { w: number; h: number; d: number; weave: string; colors: string[]; min: number; max: number }[] = [
  { w: 250, h: 26, d: 300, weave: "jersey", colors: HUNG.tee.colors, min: 3, max: 6 },
  { w: 238, h: 40, d: 312, weave: "jean", colors: ["#506b8c", "#35435e", "#6a86a6", "#7b7f72", "#4b4d52", "#c4b196"], min: 2, max: 4 },
  { w: 272, h: 56, d: 316, weave: "lana", colors: HUNG.sweater.colors, min: 2, max: 3 },
];

/** el calzado: zapatillas, zapatos y botitas (ancho, alto y largo de cada pie; capellada, suela y cordones) */
const SHOES: { size: number[]; colors: string[][] }[] = [
  { size: [98, 112, 286], colors: [["#f1efea", "#f6f4ef", "#e9e6df"], ["#2b2b2d", "#f1efea", "#2b2b2d"], ["#c8c2b5", "#efe9dc", "#f1efea"], ["#31445c", "#f1efea", "#f1efea"], ["#7c8a78", "#e6dcc6", "#efe9dc"]] },
  { size: [96, 72, 292], colors: [["#6b4a34", "#2a211c", "#3a2a20"], ["#232325", "#161617", "#232325"], ["#8a5a3c", "#3a2a20", "#5a3a26"]] },
  { size: [100, 168, 290], colors: [["#5a4636", "#2a211c", "#3a2a20"], ["#2b2b2d", "#1a1a1b", "#2b2b2d"], ["#9a7a55", "#e6dcc6", "#7a5f40"]] },
];

/** las cajas de tela (cuerpo y manija o portaetiqueta) y los canastos de fibra */
const BOXES = [["#eeeae2", "#8f8a80"], ["#5d6066", "#c9c5bc"], ["#d3ccbe", "#7a5a40"], ["#b9b4aa", "#f4f2ee"], ["#394453", "#c9c5bc"]];
const BASKETS = ["#c2a374", "#a98a5c", "#d4c19c"];
const WOOD = ["#d2b48a", "#c9a877", "#b8905e"];

/** un número estable a partir de un texto: la misma ropa cada vez que se arma el mismo placard */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** pseudoaleatorio con semilla */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(list: readonly T[], r: number): T => list[Math.min(list.length - 1, Math.floor(r * list.length))];

type Extra = { shape: GarmentShape; variant: number; colors?: string[]; rotationY?: number };

/** una cosa de la ambientación, con su caja (esquina mínima y medida, en mm) */
function extra(id: string, label: string, material: string, run: number, position: Part["position"], size: Part["size"], garment: Extra): Part {
  const { rotationY, ...shape } = garment;
  return {
    id,
    label,
    kind: "shelf",
    material,
    run,
    module: null,
    position,
    size,
    geometry: "garment",
    garment: shape,
    rotationY,
    decor: true,
    cut: null,
    explode: [0, 0, 0],
  };
}

/** lo que se pone junto: una prenda con su percha, una pila, un par. Si una parte no entra, se va todo */
type Group = Part[];

const overlapX = (p: Part, xa: number, xb: number) => p.position[0] < xb && p.position[0] + p.size[0] > xa;

/** la altura de la cara de abajo de una pieza entre dos x (un techo inclinado baja hacia un lado) */
function underside(p: Part, xa: number, xb: number): number {
  if (!p.rotationZ) return p.position[1];
  const cx = p.position[0] + p.size[0] / 2;
  const cy = p.position[1] + p.size[1] / 2;
  const at = (x: number) => cy + (x - cx) * Math.tan(p.rotationZ!) - p.size[1] / 2 / Math.cos(p.rotationZ!);
  return Math.min(at(xa), at(xb));
}

function dress(run: RunAssembly): Group[] {
  const groups: Group[] = [];
  const hung: Part[] = [];
  const keep = (g: Group) => groups.push(g);
  const real = run.parts.filter((p) => !p.decor);
  // dónde apoya algo: pisos, estantes, frentes de cajón, techos
  const solid = real.filter((p) => ["bottom", "shelf", "fixed-shelf", "drawer-front", "top"].includes(p.kind));
  // lo que hace de techo: todo menos los frentes, el fondo y las luces (una mancha de luz no ocupa lugar)
  const over = real.filter((p) => !p.front && !["back", "glow", "led", "door", "sliding-door", "side", "divider", "plinth"].includes(p.kind));
  /** hasta dónde hay lugar libre debajo de una altura, entre dos x */
  const floorUnder = (xa: number, xb: number, y: number) => Math.max(0, ...solid.filter((s) => overlapX(s, xa, xb) && s.position[1] + s.size[1] <= y).map((s) => s.position[1] + s.size[1]));
  /** y hasta dónde hacia arriba: la primera pieza, o la ropa que ya cuelga ahí */
  const ceilingOver = (xa: number, xb: number, y: number) =>
    Math.min(Infinity, ...[...over, ...hung].filter((s) => overlapX(s, xa, xb) && underside(s, xa, xb) >= y - 1).map((s) => underside(s, xa, xb)));
  // el interior llega del fondo al frente de los estantes: de ahí no se pasa nada
  const backZ = Math.max(0, ...real.filter((p) => p.kind === "back").map((p) => p.position[2] + p.size[2]));
  const shelves = real.filter((p) => p.kind === "shelf" || p.kind === "fixed-shelf");
  const rods = real.filter((p) => p.kind === "rod");
  const frontZ = Math.min(
    Infinity,
    ...shelves.map((p) => p.position[2] + p.size[2]),
    ...rods.map((p) => 2 * (p.position[2] + p.size[2] / 2) - backZ),
    ...real.filter((p) => p.kind === "bottom").map((p) => p.position[2] + p.size[2] - 60),
  );

  // primero lo colgado: después, lo que va abajo se acomoda a lo que cuelga
  for (const rod of rods) {
    const rand = rng(hash(rod.id));
    const cy = rod.position[1] + rod.size[1] / 2;
    const zc = rod.position[2] + rod.size[2] / 2;
    const neck = cy - HANGER.neck;
    // lo ancho de hombros que entra entre el fondo y el frente
    const wMax = Math.floor((2 * Math.min(zc - backZ, frontZ - zc) - 24) / 20) * 20;
    if (wMax < 300) continue;
    const from = rod.position[0] + 28;
    const to = rod.position[0] + rod.size[0] - 28;
    /** cuánto puede medir de largo una prenda colgada entre dos x */
    const clear = (xa: number, xb: number, rise: number) => neck + 2 + rise - floorUnder(xa, xb, cy) - 40;
    const mirror = rand() < 0.5;
    const phase = rand() * 6.283;
    // en un módulo ancho queda barral libre: se ve más ordenado
    const air = rand();
    const fill = from + (to - from) * (1 - Math.min(1, Math.max(0, (to - from - 600) / 300)) * (0.2 - 0.16 * air));
    // el orden de los grupos; donde hay altura, lo largo va primero, contra un costado
    const order: HungShape[] = ["shirt", "tee", "pants", "sweater", "jacket", "shirt"];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const tall = clear(from, to, 0) >= HUNG.dress.len[2];
    if (tall) order.unshift(rand() < 0.5 ? "dress" : "coat");
    else rand();
    let x = from + 4 + rand() * 22;
    let half = 0;
    let n = 0;
    let last = "";
    const hanger = (id: string, at: number, kind: number, width: number, yaw: number, r: number) => {
      const w = Math.min(HANGER.width, wMax, width);
      const colors = kind === 1 ? ["#262627", "#b9bcc0"] : [pick(WOOD, r), "#b9bcc0"];
      return extra(id, "Percha", "paint:#ffffff", rod.run, [at - HANGER.thick / 2, cy + HANGER.hookTop - HANGER_HEIGHT, zc - w / 2], [HANGER.thick, HANGER_HEIGHT, w], { shape: "hanger", variant: kind, colors, rotationY: yaw || undefined });
    };
    const at = (v: number) => (mirror ? from + to - v : v);
    groupLoop: for (let g = 0; g < 12; g++) {
      const shape = order[g % order.length];
      const spec = HUNG[shape];
      const count = (shape === "shirt" ? 3 : 2) + Math.floor(rand() * (shape === "coat" || shape === "dress" ? 2 : 3));
      for (let k = 0; k < count; k++) {
        // siempre los mismos sorteos por prenda: al cambiar una medida no cambia la ropa
        const [rv, rc, rj, rf, rw] = [rand(), rand(), rand(), rand(), rand()];
        let use = shape;
        let s = spec;
        let variant = Math.floor(rv * 3);
        x += (half + s.t / 2) * 0.93 + rj * 9;
        if (x + s.t / 2 > fill || n >= 18) break groupLoop;
        const [xa, xb] = [at(x) - s.t / 2, at(x) + s.t / 2];
        // si lo largo no entra, una prenda más corta; y si ni esa, se acorta
        if (clear(xa, xb, s.rise) < s.len[variant]) variant = s.len.indexOf(Math.min(...s.len));
        if (clear(xa, xb, s.rise) < s.len[variant] && (use === "coat" || use === "dress")) {
          use = "shirt";
          s = HUNG.shirt;
          variant = 1;
        }
        const room = clear(xa, xb, s.rise);
        const len = Math.min(s.len[variant], Math.floor(room / 20) * 20);
        half = s.t / 2;
        if (len < s.len[variant] * 0.72) continue;
        let color = pick(s.colors, rc);
        if (color === last) color = s.colors[(s.colors.indexOf(color) + 1) % s.colors.length];
        last = color;
        const w = Math.min(s.w, wMax);
        const top = neck + 2 + s.rise;
        // las prendas no cuelgan derechas ni todas para el mismo lado
        const yaw = 0.07 * Math.sin(n * 0.9 + phase);
        const id = `deco:${rod.id}:${n}`;
        const pair = [
          hanger(`${id}:percha`, at(x), s.hanger, use === "pants" ? HANGER.width : w - 2 * s.out * (w / s.w) - 14, yaw, rw),
          extra(id, "Ropa colgada", `cloth:${s.weave}:${color}`, rod.run, [at(x) - s.t / 2, top - len, zc - w / 2], [s.t, len, w], { shape: use, variant, rotationY: yaw + (rf < 0.5 ? Math.PI : 0) }),
        ];
        keep(pair);
        hung.push(...pair);
        n++;
      }
      // entre grupos, aire; y cada tanto una percha vacía: un placard lleno parejo no parece de nadie
      const [re, rg, rk] = [rand(), rand(), rand()];
      if (re < 0.42) {
        x += half + 30 + rg * 20;
        half = HANGER.thick / 2;
        if (x + half > fill) break;
        keep([hanger(`deco:${rod.id}:v${g}`, at(x), rk < 0.5 ? 0 : 1, HANGER.width, 0.07 * Math.sin(g * 2.1 + phase), rk)]);
      }
      x += 26 + rg * 48;
    }
  }

  // después lo apoyado, de abajo hacia arriba
  const surfaces = real.filter((p) => p.kind === "bottom" || p.kind === "shelf" || p.kind === "fixed-shelf").sort((a, b) => a.position[1] - b.position[1]);
  for (const p of surfaces) {
    const top = p.position[1] + p.size[1];
    const xa = p.position[0] + 24;
    const xb = p.position[0] + p.size[0] - 24;
    const width = xb - xa;
    const front = Math.min(p.position[2] + p.size[2], frontZ);
    const depth = front - Math.max(p.position[2], backZ);
    const room = ceilingOver(xa, xb, top) - top;
    if (width < 280 || depth < 300 || room < 105) continue;
    const rand = rng(hash(p.id));
    const id = (k: string | number) => `deco:${p.id}:${k}`;
    /** el lugar libre sobre un tramo del estante */
    const free = (a: number, b: number) => ceilingOver(a, b, top) - top;

    /** un par de zapatos, las puntas hacia adelante, apenas abiertas */
    const pair = (key: string, cx: number, r: [number, number, number, number]): boolean => {
      const model = r[0] < 0.5 ? 0 : r[0] < 0.78 ? 1 : 2;
      const [sw, sh, sl] = SHOES[model].size;
      const len = Math.min(sl, Math.floor((depth - 30) / 10) * 10);
      if (free(cx - sw - 12, cx + sw + 12) < sh + 45) return false;
      const colors = [...pick(SHOES[model].colors, r[1])];
      const z = front - 26 - r[2] * 30 - len;
      keep(
        [0, 1].map((side) =>
          extra(`${id(key)}:${side}`, "Calzado", "paint:#ffffff", p.run, [cx + (side ? 7 : -7 - sw), top, z + (side ? r[3] * 14 : 0)], [sw, sh, len], {
            shape: "shoe",
            variant: model * 2 + side,
            colors,
            rotationY: (side ? 1 : -1) * 0.05,
          }),
        ),
      );
      return true;
    };
    /** un canasto de fibra, con una manta doblada adentro */
    const basket = (key: string, cx: number, w: number, h: number, r: [number, number]) => {
      const d = Math.min(300, Math.floor((depth - 40) / 10) * 10);
      const z = front - 34 - d;
      const g = [extra(id(key), "Canasto", "paint:#ffffff", p.run, [cx - w / 2, top, z], [w, h, d], { shape: "basket", variant: Math.floor(r[0] * 3), colors: [pick(BASKETS, r[0])] })];
      if (r[1] < 0.7) g.push(extra(`${id(key)}:manta`, "Ropa doblada", `cloth:lana:${pick(FOLDED[2].colors, r[1] / 0.7)}`, p.run, [cx - w / 2 + 34, top + h - 34, z + 30], [w - 68, 48, d - 60], { shape: "folded", variant: 8 + Math.floor(r[1] * 4) }));
      keep(g);
    };

    if (p.kind === "bottom" && top < 400) {
      // el piso del módulo: calzado y, si hay lugar, un canasto
      let x0 = xa;
      let x1 = xb;
      const [rs, rb, r2] = [rand(), rand(), rand()];
      if (width >= 640 && rb < 0.6) {
        const w = 340;
        const cx = rs < 0.5 ? xa + 12 + w / 2 : xb - 12 - w / 2;
        if (free(cx - w / 2, cx + w / 2) >= 330) {
          basket("canasto", cx, w, 250, [r2, rb / 0.6]);
          if (rs < 0.5) x0 = cx + w / 2 + 20;
          else x1 = cx - w / 2 - 20;
        }
      }
      const pairs = Math.min(4, Math.floor((x1 - x0) / 246));
      for (let i = 0; i < pairs; i++) {
        const r: [number, number, number, number] = [rand(), rand(), rand(), rand()];
        const skip = rand();
        if (i > 0 && skip < 0.22) continue;
        pair(`z${i}`, x0 + ((x1 - x0) / pairs) * (i + 0.5) + (skip - 0.5) * 16, r);
      }
    } else if (top >= 1650) {
      // arriba, lo que se usa poco: cajas de tela y algún canasto
      const slots = Math.min(3, Math.floor(width / 342));
      let any = false;
      for (let i = 0; i < slots; i++) {
        const [rk, rv, rc, rj, rz] = [rand(), rand(), rand(), rand(), rand()];
        if (rk > 0.8 && (any || i < slots - 1)) continue;
        const cx = xa + (width / slots) * (i + 0.5) + (rj - 0.5) * 24;
        const span = free(cx - 170, cx + 170);
        if (rk < 0.16 && span >= 250) {
          basket(`c${i}`, cx, 320, Math.min(240, Math.floor((span - 60) / 10) * 10), [rv, rc]);
          any = true;
          continue;
        }
        // chatas con tapa (de a dos, una sobre otra) o altas con manija o etiqueta
        const flat = rv < 0.3;
        const h = flat ? 120 : Math.min([230, 200, 260][Math.floor(rv * 3)], Math.floor((span - 36) / 10) * 10);
        if (h < 110 || span < h + 30) continue;
        const w = flat ? 330 : 310;
        const d = Math.min(flat ? 400 : 380, Math.floor((depth - 44) / 10) * 10);
        const colors = [...pick(BOXES, rc)];
        const z = front - 26 - rz * 22 - d;
        const g = [extra(id(`c${i}`), "Caja", "cloth:lino:#ffffff", p.run, [cx - w / 2, top, z], [w, h, d], { shape: "box", variant: flat ? 2 : Math.floor(rj * 2), colors })];
        if (flat && span >= 2 * h + 34)
          g.push(extra(id(`c${i}b`), "Caja", "cloth:lino:#ffffff", p.run, [cx - w / 2 + 6, top + h, z - 8], [w - 14, h - 10, d - 16], { shape: "box", variant: 2, colors: [...pick(BOXES, (rc + 0.37) % 1)], rotationY: (rz - 0.5) * 0.06 }));
        keep(g);
        any = true;
      }
    } else if (top < 560 && p.kind === "shelf") {
      // un estante bajo: calzado
      const pairs = Math.min(4, Math.floor(width / 246));
      for (let i = 0; i < pairs; i++) {
        const r: [number, number, number, number] = [rand(), rand(), rand(), rand()];
        const skip = rand();
        if (i > 0 && skip < 0.2) continue;
        pair(`z${i}`, xa + (width / pairs) * (i + 0.5) + (skip - 0.5) * 14, r);
      }
    } else {
      // a la altura de la mano: pilas de ropa doblada
      const slots = Math.min(3, Math.floor(width / 288));
      let any = false;
      for (let i = 0; i < slots; i++) {
        const [rk, rt, rn, rj, rz] = [rand(), rand(), rand(), rand(), rand()];
        const rolls = Array.from({ length: 6 }, () => [rand(), rand(), rand()]);
        if (rk < 0.2 && (any || i < slots - 1)) continue;
        const type = rt < 0.45 ? 0 : rt < 0.7 ? 1 : 2;
        const f = FOLDED[type];
        const cx = xa + (width / slots) * (i + 0.5) + (rj - 0.5) * 20;
        const span = free(cx - f.w / 2 - 10, cx + f.w / 2 + 10);
        const count = Math.min(f.min + Math.floor(rn * (f.max - f.min + 1)), Math.floor((span - 45) / f.h));
        if (count < 1) continue;
        const d = Math.min(f.d, Math.floor((depth - 30) / 10) * 10);
        const pile: Part[] = [];
        let y = top;
        let last = "";
        for (let k = 0; k < count; k++) {
          const [ra, rb, rc] = rolls[k];
          let color = pick(f.colors, ra);
          if (color === last) color = f.colors[(f.colors.indexOf(color) + 1) % f.colors.length];
          last = color;
          // cada prenda de la pila, apenas corrida y girada respecto de la de abajo
          pile.push(
            extra(id(`p${i}:${k}`), "Ropa doblada", `cloth:${f.weave}:${color}`, p.run, [cx - f.w / 2 + (rb - 0.5) * 14, y, front - 22 - rz * 26 - d - rc * 12], [f.w, f.h, d], {
              shape: "folded",
              variant: type * 4 + Math.floor(rc * 4),
              rotationY: (rb - 0.5) * 0.05 || undefined,
            }),
          );
          // la de arriba aplasta un poco a la de abajo
          y += f.h - 2;
        }
        keep(pile);
        any = true;
      }
    }
  }
  return groups;
}

/** la caja de una pieza en el ambiente: los tramos de un placard en L van girados */
function worldBox(run: RunAssembly, p: Part): { min: number[]; max: number[] } {
  const a = toWorld(run, p.position);
  const b = toWorld(run, [p.position[0] + p.size[0], p.position[1] + p.size[1], p.position[2] + p.size[2]]);
  return { min: a.map((v, i) => Math.min(v, b[i])), max: a.map((v, i) => Math.max(v, b[i])) };
}

const crosses = (a: { min: number[]; max: number[] }, b: { min: number[]; max: number[] }) => [0, 1, 2].every((k) => a.min[k] < b.max[k] - 2 && a.max[k] > b.min[k] + 2);

/** el mismo placard, vestido: con ropa colgada y doblada, calzado, cajas y canastos */
export function dressed(assembly: Assembly): Assembly {
  // las piezas de verdad, cada una con su caja en el ambiente (las luces pintadas no ocupan lugar;
  // el techo inclinado se respeta al acomodar, con su pendiente)
  const solids = assembly.runs.map((r) => r.parts.filter((p) => !p.decor && p.kind !== "glow" && p.kind !== "led" && p.material !== "none" && !p.rotationZ).map((p) => ({ part: p, box: worldBox(r, p) })));
  const kept: { min: number[]; max: number[] }[][] = assembly.runs.map(() => []);
  const parts = assembly.runs.map((run, r) =>
    dress(run)
      .filter((group) => {
        // la red de seguridad: lo que se cruza con una pieza (un parante de esquina delante del
        // barral) o, en la esquina de un placard en L, con la ropa del otro tramo, no va
        const boxes = group.map((p) => worldBox(run, p));
        const hit = group.some((p, i) =>
          assembly.runs.some(
            (_, o) =>
              // (el gancho de la percha abraza su barral)
              solids[o].some((s) => !(o === r && p.label === "Percha" && s.part.kind === "rod") && crosses(boxes[i], s.box)) || (o !== r && kept[o].some((b) => crosses(boxes[i], b))),
          ),
        );
        if (!hit) kept[r].push(...boxes);
        return !hit;
      })
      .flat(),
  );
  return { ...assembly, runs: assembly.runs.map((r, i) => ({ ...r, parts: [...r.parts, ...parts[i]] })) };
}

/** el mueble solo, sin nada de lo que lo acompaña */
export function undressed(assembly: Assembly): Assembly {
  // lo que va colgado de una pieza (el colchón de una cama con trampilla) también sale
  const bare = (p: Part): Part => (p.details?.some((d) => d.decor) ? { ...p, details: p.details.filter((d) => !d.decor) } : p);
  return { ...assembly, room: undefined, runs: assembly.runs.map((r) => ({ ...r, parts: r.parts.filter((p) => !p.decor).map(bare) })) };
}
