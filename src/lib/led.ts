import type { Part, Vec3 } from "./assembly.ts";

/**
 * La luz que tira una tira LED, para el 3D rápido.
 *
 * Una tira es una fila de puntos que alumbran hacia un lado (el difusor): lo
 * que llega a cada punto de una placa es la suma de toda la fila, y esa cuenta
 * tiene solución exacta (`irradiance`). Con eso la luz cae como en una foto:
 * fuerte bajo la tira, abierta y suave con la distancia, más intensa en el
 * lateral junto a la punta de la tira, sin dibujar ningún degradé a mano.
 *
 * Cada tira lleva una pieza "glow" con la caja del hueco que alumbra y las
 * caras de esa caja que reciben luz (`Wash`). El 3D la dibuja con un material
 * que hace la cuenta en cada píxel y multiplica lo que hay debajo. La cara
 * "air" es una cortina en la boca del hueco: aclara todo lo que se ve a través
 * (la ropa, los objetos), que es lo que una mancha pegada a las placas no hace.
 * En el modo foto nada de esto se ve: ahí la tira es una luz de verdad.
 */

export type Axis = 0 | 1 | 2;
/** caras de la caja, por el lado en que están: x0 es la de x mínima; "air", la cortina de la boca */
export type WashFace = "x0" | "x1" | "y0" | "y1" | "z0" | "z1" | "air";
export type WashSide = "x0" | "x1" | "z0" | "z1";

export type Wash = {
  /** dónde arranca la tira, en mm desde la esquina mínima de la caja */
  from: Vec3;
  /** sobre qué eje corre y cuánto mide */
  axis: Axis;
  length: number;
  /** hacia dónde alumbra: un eje y su sentido */
  emit: [Axis, 1 | -1];
  faces: WashFace[];
  /** la cara donde va montada la tira: ahí no cae luz, solo el resplandor del difusor */
  carrier?: "x0" | "x1" | "y1";
  /** lados de la caja sin pared: ahí la luz se apaga sola en vez de cortar en seco */
  open?: WashSide[];
  /** a qué z de la caja va la cortina (si no, en la boca) */
  airAt?: number;
};

/** medio ancho del difusor, en metros: junto a la tira la luz no se va al infinito */
export const SOFT = 0.03;
/** a qué distancia de la tira se supone lo que la cortina alumbra, en metros */
export const AIR_REACH = 0.14;
/** el resplandor sobre la placa que lleva la tira: a qué distancia ya cayó a la mitad, en metros */
export const HALO_REACH = 0.014;
/** en cuántos metros, pasando el plano de la tira, la luz termina de prenderse (el difusor asoma: no corta en seco) */
export const GATE = 0.03;
/** cuánto de su luz manda la tira a lo largo de sí misma: un difusor largo alumbra hacia los costados, poco hacia las puntas */
export const END = 0.5;
/** las caras se despegan de la placa para no pelearse con ella, en mm */
const LIFT = 1;
/** cuánto de cada lado abierto se usa para apagar la luz */
const FADE = 0.42;

const smooth = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

/**
 * Luz que llega a un punto de una superficie desde una tira que va de x = 0 a
 * x = `length` y alumbra hacia −y (todo en metros, en el sistema de la tira).
 * `rel` es el punto y `n` la normal de la superficie. El difusor redondo
 * reparte la luz pareja hacia todo su lado: la cuenta es la integral, a lo
 * largo de la tira, de cos(receptor) / distancia².
 */
export function irradiance(rel: Vec3, n: Vec3, length: number): number {
  const r2 = rel[1] * rel[1] + rel[2] * rel[2] + SOFT * SOFT;
  const j1 = (u: number) => u / (r2 * Math.sqrt(r2 + u * u));
  const j2 = (u: number) => -1 / Math.sqrt(r2 + u * u);
  const u1 = -rel[0];
  const u2 = length - rel[0];
  const a = -(n[1] * rel[1] + n[2] * rel[2]);
  return Math.max(0, smooth(-rel[1] / GATE) * (a * (j1(u2) - j1(u1)) + END * n[0] * (j2(u2) - j2(u1))));
}

/** luz que cruza un punto del aire, mire para donde mire lo que haya ahí: la de la cortina */
export function fluence(rel: Vec3, length: number): number {
  const r = Math.sqrt(rel[1] * rel[1] + AIR_REACH * AIR_REACH);
  return Math.max(0, (smooth(-rel[1] / GATE) * (Math.atan((length - rel[0]) / r) - Math.atan(-rel[0] / r))) / r);
}

/** el resplandor del difusor sobre la placa que lo lleva: fuerte pegado al perfil y apagado a pocos centímetros */
export function halo(rel: Vec3, length: number): number {
  const r = Math.sqrt(rel[2] * rel[2] + HALO_REACH * HALO_REACH);
  return Math.max(0, ((Math.atan((length - rel[0]) / r) - Math.atan(-rel[0] / r)) * HALO_REACH) / (Math.PI * r));
}

export type WashMesh = {
  /** mm desde el centro de la caja */
  position: number[];
  /** el mismo punto en el sistema de la tira, en metros */
  rel: number[];
  /** normal de la cara en el sistema de la tira; el cuarto número es 1 en la cortina y 2 en la cara que lleva la tira */
  aim: number[];
  uv: number[];
  /** ancho del apagado en cada borde (u0, u1, v0, v1), en fracción del lado */
  edge: number[];
  /** largo de la tira en metros, repetido en cada vértice */
  span: number[];
  index: number[];
};

const unit = (axis: Axis, sign = 1): Vec3 => [axis === 0 ? sign : 0, axis === 1 ? sign : 0, axis === 2 ? sign : 0];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** los ejes de la tira en el espacio de la caja: a lo largo, contra la luz y el tercero */
export function frame(wash: Pick<Wash, "axis" | "emit">): [Vec3, Vec3, Vec3] {
  const x = unit(wash.axis);
  const y = unit(wash.emit[0], -wash.emit[1]);
  return [x, y, cross(x, y)];
}

/** las caras de una luz, listas para dibujar: un rectángulo por cara, todas en una sola malla */
export function washMesh(size: Vec3, wash: Wash): WashMesh {
  const [w, h, d] = size;
  const out: WashMesh = { position: [], rel: [], aim: [], uv: [], edge: [], span: [], index: [] };
  const axes = frame(wash);
  const open = (side: WashSide) => (wash.open?.includes(side) ? FADE : 0);
  const quad = (corners: [Vec3, Vec3, Vec3, Vec3], normal: Vec3 | null, edge: [number, number, number, number], kind = normal ? 0 : 1) => {
    const base = out.position.length / 3;
    const uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    corners.forEach((c, i) => {
      out.position.push(c[0] - w / 2, c[1] - h / 2, c[2] - d / 2);
      const p: Vec3 = [c[0] - wash.from[0], c[1] - wash.from[1], c[2] - wash.from[2]];
      out.rel.push(dot(p, axes[0]) / 1000, dot(p, axes[1]) / 1000, dot(p, axes[2]) / 1000);
      if (normal) out.aim.push(dot(normal, axes[0]), dot(normal, axes[1]), dot(normal, axes[2]), kind);
      else out.aim.push(0, 0, 0, kind);
      out.uv.push(uvs[i * 2], uvs[i * 2 + 1]);
      out.edge.push(...edge);
      out.span.push(wash.length / 1000);
    });
    out.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (const face of wash.faces) {
    const kind = face === wash.carrier ? 2 : 0;
    if (face === "z0" || face === "z1") {
      const z = face === "z0" ? LIFT : d - LIFT;
      quad([[0, 0, z], [w, 0, z], [w, h, z], [0, h, z]], [0, 0, face === "z0" ? 1 : -1], [open("x0"), open("x1"), 0, 0]);
    } else if (face === "y0") {
      quad([[0, LIFT, 0], [w, LIFT, 0], [w, LIFT, d], [0, LIFT, d]], [0, 1, 0], [open("x0"), open("x1"), open("z0"), open("z1")]);
    } else if (face === "y1") {
      quad([[0, h - LIFT, 0], [w, h - LIFT, 0], [w, h - LIFT, d], [0, h - LIFT, d]], [0, -1, 0], [open("x0"), open("x1"), open("z0"), open("z1")], kind);
    } else if (face === "x0" || face === "x1") {
      const x = face === "x0" ? LIFT : w - LIFT;
      quad([[x, 0, 0], [x, 0, d], [x, h, d], [x, h, 0]], [face === "x0" ? 1 : -1, 0, 0], [open("z0"), open("z1"), 0, 0], kind);
    } else {
      const z = wash.airAt ?? d - LIFT;
      // la cortina se apaga antes de llegar al piso del hueco: abajo no deja una línea sobre el estante
      quad([[0, 0, z], [w, 0, z], [w, h, z], [0, h, z]], null, [open("x0"), open("x1"), wash.emit[0] === 1 ? 0.3 : 0, 0]);
    }
  }
  return out;
}

/** la pieza de luz de una tira: la caja del hueco y qué caras alumbra */
export function washPart(id: string, position: Vec3, size: Vec3, wash: Wash, extra: Partial<Part> = {}): Part {
  return { id, label: "Luz", kind: "glow", material: "glow", run: 0, module: null, position, size, geometry: "glow", wash, cut: null, explode: [0, 0, 0], ...extra };
}

/** con qué se mueve una pieza: las de un mismo cajón salen juntas */
const group = (p: Part) => (p.openShift ? `${p.module}|${p.openShift.join(",")}` : "");
const real = (p: Part) => !p.decor && p.kind !== "glow" && p.kind !== "led" && p.material !== "none" && p.material !== "glass" && p.geometry !== "none";
const boxy = (p: Part) => (p.geometry === "box" || p.geometry === "soft") && !p.rotationZ && !p.rotationY && !p.plan;
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);

/**
 * Le pone su luz a cada tira de un mueble mirando qué tiene alrededor: el piso
 * del hueco es lo primero que hay abajo de la tira, y las paredes, las placas
 * que lo cierran a los costados y atrás. Donde no hay pared (bajo una cama, en
 * el piso de la habitación) la luz se abre y se apaga sola. Las tiras de un
 * cajón miran solo las piezas de su cajón, y su luz sale con él.
 */
export function lightUp(parts: Part[]): void {
  const strips = parts.filter((p) => p.kind === "led" && !p.decor);
  for (const strip of strips) {
    const [sx, sy, sz] = strip.size;
    // las tiras de estos muebles van acostadas y alumbran hacia abajo
    if (sy >= sx && sy >= sz) continue;
    const A: 0 | 2 = sx >= sz ? 0 : 2;
    const C: 0 | 2 = A === 0 ? 2 : 0;
    const a0 = strip.position[A];
    const a1 = a0 + strip.size[A];
    const c0 = strip.position[C];
    const c1 = c0 + strip.size[C];
    const cMid = (c0 + c1) / 2;
    // la placa que lleva la tira: el techo del hueco
    const top = strip.position[1] + strip.size[1];
    const own = group(strip);
    // la tira de un cajón solo ve su cajón; una tira quieta ve todo (un cajón abajo le tapa el piso)
    const others = parts.filter((p) => p !== strip && real(p) && (!own || group(p) === own));
    // las del mismo grupo: lo que está quieto para una tira quieta, el cajón para la tira del cajón
    const mine = (p: Part) => group(p) === own && boxy(p) && (own ? true : !p.front && !p.hinge && !p.slide);

    // el piso: lo más alto que haya abajo de la tira
    let floor: Part | null = null;
    let floorY = 0;
    for (const p of others) {
      const y = p.position[1] + p.size[1];
      if (y > strip.position[1] + 0.5 || y <= floorY) continue;
      if (overlap(a0, a1, p.position[A], p.position[A] + p.size[A]) < strip.size[A] * 0.5) continue;
      if (p.position[C] > cMid || p.position[C] + p.size[C] < cMid) continue;
      floor = p;
      floorY = y;
    }
    // un cajón de un grupo ajeno o un frente abajo de la tira: la luz no tiene dónde quedarse quieta
    if (floor && !mine(floor)) continue;
    // en el piso de la habitación el charco va apenas despegado
    const y0 = floor ? floorY : 2;
    const gap = top - y0;
    if (gap < 40 || gap > 1600) continue;
    const reach = Math.min(1000, Math.max(200, gap * 2.5));

    // las paredes: placas que cubren buena parte del alto del hueco
    const walls = others.filter((p) => mine(p) && p !== floor && overlap(y0, top, p.position[1], p.position[1] + p.size[1]) >= gap * 0.5);
    const wall = (axis: 0 | 2, sign: 1 | -1, from: number, limit: number, lo: number, hi: number): { face: number; part: Part } | null => {
      const other = axis === 0 ? 2 : 0;
      let best: { face: number; part: Part } | null = null;
      for (const p of walls) {
        if (overlap(lo, hi, p.position[other], p.position[other] + p.size[other]) < (hi - lo) * 0.5) continue;
        // la cara de la placa que mira al hueco
        const face = sign < 0 ? p.position[axis] + p.size[axis] : p.position[axis];
        const dist = sign < 0 ? from - face : face - from;
        if (dist < -3 || dist > limit) continue;
        if (best === null || (sign < 0 ? face > best.face : face < best.face)) best = { face, part: p };
      }
      return best;
    };
    const endLo = wall(A, -1, a0, 220, c0, c1);
    const endHi = wall(A, 1, a1, 220, c0, c1);
    const sideLo = wall(C, -1, c0, 900, a0, a1);
    const sideHi = wall(C, 1, c1, 900, a0, a1);
    const ends = [endLo, endHi].filter((e) => e !== null);

    // la caja: de pared a pared; donde no hay, hasta donde llega la luz o hasta el borde de la placa del piso
    const edge = (axis: 0 | 2, sign: 1 | -1, found: { face: number } | null, from: number): [number, boolean] => {
      if (found !== null) return [found.face, false];
      let far = from + sign * reach;
      // entre dos costados (las bases de una mesa), la luz llega hasta donde llegan ellos: más allá se abriría y se pierde
      if (axis === C && ends.length) {
        const rim = sign < 0 ? Math.max(...ends.map((e) => e.part.position[C])) : Math.min(...ends.map((e) => e.part.position[C] + e.part.size[C]));
        far = sign < 0 ? Math.max(far, Math.min(rim, from - 60)) : Math.min(far, Math.max(rim, from + 60));
      }
      if (!floor) return [far, true];
      const rim = sign < 0 ? floor.position[axis] : floor.position[axis] + floor.size[axis];
      const cut = sign < 0 ? rim > far : rim < far;
      return [cut ? rim : far, !cut];
    };
    const [bA0, oA0] = edge(A, -1, endLo, a0);
    const [bA1, oA1] = edge(A, 1, endHi, a1);
    const [bC0, oC0] = edge(C, -1, sideLo, c0);
    const [bC1, oC1] = edge(C, 1, sideHi, c1);
    if (bA1 - bA0 < 20 || bC1 - bC0 < 20) continue;

    const position: Vec3 = [0, y0, 0];
    const size: Vec3 = [0, gap, 0];
    position[A] = bA0;
    position[C] = bC0;
    size[A] = bA1 - bA0;
    size[C] = bC1 - bC0;
    const name = (axis: 0 | 2, hi: boolean): WashSide => `${axis === 0 ? "x" : "z"}${hi ? 1 : 0}` as WashSide;
    // la placa que lleva la tira recibe el resplandor del difusor; una tira al aire (bajo unos cajones) no tiene dónde
    const carried = parts.some((p) => p !== strip && real(p) && Math.abs(p.position[1] - top) <= 5 && overlap(a0, a1, p.position[A], p.position[A] + p.size[A]) >= strip.size[A] * 0.5 && p.position[C] <= cMid && p.position[C] + p.size[C] >= cMid);
    const faces: WashFace[] = carried ? ["y0", "y1"] : ["y0"];
    const open: WashSide[] = [];
    for (const [axis, hi, found, isOpen] of [[A, false, endLo, oA0], [A, true, endHi, oA1], [C, false, sideLo, oC0], [C, true, sideHi, oC1]] as const) {
      if (found !== null) faces.push(name(axis, hi));
      else if (isOpen) open.push(name(axis, hi));
    }
    // un hueco cerrado a los costados y atrás: la cortina en la boca alumbra lo que tiene adentro
    if (A === 0 && !own && endLo !== null && endHi !== null && sideLo !== null && sideHi === null) faces.push("air");
    const from: Vec3 = [0, gap - strip.size[1], 0];
    from[A] = a0 - bA0;
    from[C] = cMid - bC0;
    const wash: Wash = { from, axis: A, length: strip.size[A], emit: [1, -1], faces, carrier: carried ? "y1" : undefined, open };
    const extra: Partial<Part> = { explode: strip.explode };
    if (strip.openShift) {
      extra.module = strip.module;
      extra.openShift = strip.openShift;
    }
    parts.push(washPart(`${strip.id}:luz`, position, size, wash, extra));
  }
}
