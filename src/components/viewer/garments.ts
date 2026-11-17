/**
 * Las formas de la ambientación de un placard: cada prenda colgada (camisa,
 * remera, buzo, saco, tapado, vestido, pantalón doblado sobre la varilla), su
 * percha, la ropa doblada, el calzado, las cajas de tela y los canastos.
 *
 * Todo es procedural: cada forma se arma a la medida de su caja (centrada en
 * el origen, en metros) con anillos de puntos unidos entre sí, lleva sus
 * coordenadas de textura en metros (la trama de la tela no se estira) y un
 * color por vértice: en la ropa, un sombreado suave de los pliegues que
 * multiplica el color de la tela; en lo que lleva más de un color (la suela y
 * la capellada, la caja y su etiqueta, la percha y su gancho), el color
 * entero, sobre un material blanco. Así cada cosa es una sola malla con un
 * solo material, que es lo que entiende el trazado de rayos.
 *
 * Las geometrías se guardan por forma, variante y medida y se comparten entre
 * todas las piezas iguales: un placard con cincuenta prendas usa una docena.
 */

import * as THREE from "three";

import type { GarmentShape } from "../../lib/assembly.ts";
import { HANGER, HUNG, type HungShape } from "../../lib/decor.ts";

const MM = 0.001;

type V3 = [number, number, number];
type RGB = [number, number, number];

const WHITE: RGB = [1, 1, 1];
const gray = (v: number): RGB => [v, v, v];
const rgb = (hex: string): RGB => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
/** potencia que conserva el signo: para las superelipses */
const spow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
/** el valor de una curva dada por puntos (t, v), en t */
function keyed(keys: readonly (readonly [number, number])[], t: number): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return lerp(v0, v1, smooth((t - t0) / Math.max(1e-6, t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
}

/**
 * Arma una malla de a vértices y triángulos, en mm. Los vértices de un mismo
 * grupo que caen en el mismo lugar comparten la normal (la costura de un
 * anillo no se nota); entre grupos queda una arista viva.
 */
class Builder {
  private pos: number[] = [];
  private uv: number[] = [];
  private col: number[] = [];
  private grp: number[] = [];
  private idx: number[] = [];
  private groups = 0;
  /** cuánto más fina que la de un tapizado va la trama: la ropa es tela más liviana */
  private weave: number;

  constructor(weave = 1) {
    this.weave = weave;
  }

  group() {
    return ++this.groups;
  }

  vertex(p: V3, u: number, v: number, c: RGB, g: number): number {
    this.pos.push(p[0], p[1], p[2]);
    this.uv.push(u * MM * this.weave, v * MM * this.weave);
    this.col.push(c[0], c[1], c[2]);
    this.grp.push(g);
    return this.grp.length - 1;
  }

  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c);
  }

  at(i: number): V3 {
    return [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]];
  }

  get triangles() {
    return this.idx.length / 3;
  }

  geometry(): THREE.BufferGeometry {
    const { pos, idx, grp } = this;
    const count = grp.length;
    const sums = new Map<string, V3>();
    const keys: string[] = [];
    for (let i = 0; i < count; i++) keys.push(`${grp[i]}:${Math.round(pos[i * 3] * 20)}:${Math.round(pos[i * 3 + 1] * 20)}:${Math.round(pos[i * 3 + 2] * 20)}`);
    for (let t = 0; t < idx.length; t += 3) {
      const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
      const e1 = [pos[b * 3] - pos[a * 3], pos[b * 3 + 1] - pos[a * 3 + 1], pos[b * 3 + 2] - pos[a * 3 + 2]];
      const e2 = [pos[c * 3] - pos[a * 3], pos[c * 3 + 1] - pos[a * 3 + 1], pos[c * 3 + 2] - pos[a * 3 + 2]];
      // sin normalizar: los triángulos grandes pesan más
      const n: V3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      for (const v of [a, b, c]) {
        const s = sums.get(keys[v]);
        if (s) {
          s[0] += n[0];
          s[1] += n[1];
          s[2] += n[2];
        } else sums.set(keys[v], [n[0], n[1], n[2]]);
      }
    }
    const normal = new Float32Array(count * 3);
    const position = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const s = sums.get(keys[i]) ?? [0, 1, 0];
      const l = Math.hypot(s[0], s[1], s[2]) || 1;
      normal.set([s[0] / l, s[1] / l, s[2] / l], i * 3);
      position.set([pos[i * 3] * MM, pos[i * 3 + 1] * MM, pos[i * 3 + 2] * MM], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(this.uv), 2));
    // el color va con cuatro componentes: el trazado de rayos une las mallas con colores RGBA
    // y los de tres componentes los copia mal (la ropa salía negra en el modo Realismo)
    const rgba = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) rgba.set([this.col[i * 3], this.col[i * 3 + 1], this.col[i * 3 + 2], 1], i * 4);
    g.setAttribute("color", new THREE.BufferAttribute(rgba, 4));
    g.setIndex(count > 65535 ? new THREE.BufferAttribute(new Uint32Array(idx), 1) : new THREE.BufferAttribute(new Uint16Array(idx), 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

const centroid = (ring: V3[]): V3 => {
  const c: V3 = [0, 0, 0];
  for (const p of ring) {
    c[0] += p[0] / ring.length;
    c[1] += p[1] / ring.length;
    c[2] += p[2] / ring.length;
  }
  return c;
};
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

type LoftOptions = {
  /** un color, o el de cada punto (anillo, punto) */
  color: RGB | ((i: number, j: number) => RGB);
  /** tapas del primer y del último anillo: su color, o nada */
  caps?: [RGB | null, RGB | null];
  /** una tira abierta (no un caño): los anillos no se cierran */
  open?: boolean;
  /** hacia dónde mira la superficie; si no se da, hacia afuera del eje de los anillos */
  out?: V3;
  /** cuánto se hunde (mm) el centro de cada tapa: una tapa de tela no es un plano */
  sag?: number | [number, number];
};

/**
 * Une una serie de anillos de la misma cantidad de puntos con caras, como la
 * piel de un caño de sección variable. U es el contorno del anillo y V el
 * largo recorrido, los dos en milímetros de verdad.
 */
function loft(b: Builder, rings: V3[][], o: LoftOptions) {
  const n = rings[0].length;
  const cols = o.open ? n : n + 1;
  const g = b.group();
  const color = typeof o.color === "function" ? o.color : () => o.color as RGB;
  const ids: number[][] = [];
  let v = 0;
  rings.forEach((ring, i) => {
    if (i > 0) {
      let d = 0;
      for (let j = 0; j < n; j++) d += dist(ring[j], rings[i - 1][j]) / n;
      v += d;
    }
    let u = 0;
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      const p = ring[j % n];
      if (j > 0) u += dist(p, ring[j - 1]);
      row.push(b.vertex(p, u, v, color(i, j % n), g));
    }
    ids.push(row);
  });
  // hacia dónde mirar: se prueba en el tramo del medio
  const mid = Math.min(rings.length - 2, Math.floor((rings.length - 1) / 2));
  const c = centroid([...rings[mid], ...rings[mid + 1]]);
  let facing = 0;
  for (let j = 0; j < cols - 1; j++) {
    const [p0, p1, p2] = [rings[mid][j % n], rings[mid][(j + 1) % n], rings[mid + 1][(j + 1) % n]];
    const nrm = cross(sub(p1, p0), sub(p2, p0));
    const center: V3 = [(p0[0] + p1[0] + p2[0]) / 3, (p0[1] + p1[1] + p2[1]) / 3, (p0[2] + p1[2] + p2[2]) / 3];
    facing += dot(nrm, o.out ?? sub(center, c));
  }
  const flip = facing < 0;
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < cols - 1; j++) {
      const [p0, p1, p2, p3] = [ids[i][j], ids[i][j + 1], ids[i + 1][j + 1], ids[i + 1][j]];
      if (flip) {
        b.tri(p0, p2, p1);
        b.tri(p0, p3, p2);
      } else {
        b.tri(p0, p1, p2);
        b.tri(p0, p2, p3);
      }
    }
  if (!o.caps) return;
  for (const [end, tint] of [
    [0, o.caps[0]],
    [rings.length - 1, o.caps[1]],
  ] as const) {
    if (!tint) continue;
    const ring = rings[end];
    const next = rings[end === 0 ? 1 : rings.length - 2];
    const c0 = centroid(ring);
    let away = sub(c0, centroid(next));
    if (Math.hypot(...away) < 1e-6) away = o.out ?? [0, 1, 0];
    const l = Math.hypot(...away) || 1;
    const cg = b.group();
    // la tapa se proyecta sobre sus dos ejes más anchos para la textura
    const a = away.map(Math.abs);
    const [ua, va] = a[1] >= a[0] && a[1] >= a[2] ? [0, 2] : a[0] >= a[2] ? [2, 1] : [0, 1];
    const sag = typeof o.sag === "number" ? o.sag : (o.sag?.[end === 0 ? 0 : 1] ?? 0);
    const center = b.vertex([c0[0] - (away[0] / l) * sag, c0[1] - (away[1] / l) * sag, c0[2] - (away[2] / l) * sag], c0[ua], c0[va], tint, cg);
    const rim = ring.map((p) => b.vertex(p, p[ua], p[va], tint, cg));
    for (let j = 0; j < n; j++) {
      const [p, q] = [ring[j], ring[(j + 1) % n]];
      const nrm = cross(sub(p, c0), sub(q, c0));
      if (dot(nrm, away) >= 0) b.tri(center, rim[j], rim[(j + 1) % n]);
      else b.tri(center, rim[(j + 1) % n], rim[j]);
    }
  }
}

/** una caja de caras planas (una plaquita, un botón cuadrado), con sus aristas vivas */
function plate(b: Builder, center: V3, size: V3, color: RGB) {
  const [hx, hy, hz] = size.map((v) => v / 2);
  const corner = (sx: number, sy: number, sz: number): V3 => [center[0] + sx * hx, center[1] + sy * hy, center[2] + sz * hz];
  const faces: [V3, V3, V3, V3, V3][] = [
    [corner(1, -1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(1, -1, 1), [1, 0, 0]],
    [corner(-1, -1, 1), corner(-1, 1, 1), corner(-1, 1, -1), corner(-1, -1, -1), [-1, 0, 0]],
    [corner(-1, 1, -1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, 1, -1), [0, 1, 0]],
    [corner(-1, -1, 1), corner(-1, -1, -1), corner(1, -1, -1), corner(1, -1, 1), [0, -1, 0]],
    [corner(-1, -1, 1), corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1), [0, 0, 1]],
    [corner(1, -1, -1), corner(-1, -1, -1), corner(-1, 1, -1), corner(1, 1, -1), [0, 0, -1]],
  ];
  for (const [p0, p1, p2, p3, out] of faces) loft(b, [[p0, p1], [p3, p2]], { color, open: true, out });
}

/** un anillo: una superelipse de semiejes a y b sobre dos ejes, centrada en c */
function ellipse(c: V3, ua: V3, ub: V3, a: number, bb: number, n: number, e = 1): V3[] {
  const out: V3[] = [];
  for (let j = 0; j < n; j++) {
    const s = (j / n) * 2 * Math.PI;
    const [ca, sa] = [a * spow(Math.cos(s), e), bb * spow(Math.sin(s), e)];
    out.push([c[0] + ua[0] * ca + ub[0] * sa, c[1] + ua[1] * ca + ub[1] * sa, c[2] + ua[2] * ca + ub[2] * sa]);
  }
  return out;
}

/** un rectángulo de esquinas redondeadas en planta (x, z), a la altura y: 4·n puntos */
function roundRect(hx: number, hz: number, r: number, y: number, n: number): V3[] {
  const rr = Math.min(r, hx - 0.01, hz - 0.01);
  const out: V3[] = [];
  const corners: [number, number, number][] = [
    [hx - rr, hz - rr, 0],
    [-(hx - rr), hz - rr, Math.PI / 2],
    [-(hx - rr), -(hz - rr), Math.PI],
    [hx - rr, -(hz - rr), 1.5 * Math.PI],
  ];
  for (const [cx, cz, a0] of corners)
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / (n - 1)) * (Math.PI / 2);
      out.push([cx + rr * Math.cos(a), y, cz + rr * Math.sin(a)]);
    }
  return out;
}

// ---------------------------------------------------------------------------
// La ropa colgada

type Cut = {
  /** media abertura del cuello y caída del hombro, en mm */
  neck: number;
  slope: number;
  /** medio grosor en el cuello, el hombro, el pecho y el ruedo, como fracción del disponible */
  thin: [number, number, number, number];
  /** qué tan hondos son los pliegues, como fracción del medio grosor disponible */
  folds: number;
  /** cuánto se angosta hacia el ruedo (negativo: se abre, como una falda) */
  inset: number;
  /** cuánto sube el ruedo en los costados: el faldón de una camisa */
  tail: number;
  /** cuánto aprieta la cintura elástica de un buzo */
  band: number;
  /** largo de la manga desde el hombro (0: sin mangas; negativo: manga corta) y qué tan angosto es el puño */
  sleeve: number;
  cuff: number;
  collar: "shirt" | "crew" | "lapel" | "none";
  front: "placket" | "open" | "none";
  /** cuánto entalla la cintura */
  waist: number;
};

const CUTS: Record<Exclude<HungShape, "pants">, Cut> = {
  shirt: { neck: 64, slope: 62, thin: [0.36, 0.44, 0.56, 0.58], folds: 0.34, inset: 0.05, tail: 44, band: 0, sleeve: 600, cuff: 0.84, collar: "shirt", front: "placket", waist: 0 },
  tee: { neck: 82, slope: 58, thin: [0.38, 0.46, 0.56, 0.56], folds: 0.36, inset: 0.03, tail: 0, band: 0, sleeve: -1, cuff: 1, collar: "crew", front: "none", waist: 0 },
  sweater: { neck: 84, slope: 60, thin: [0.36, 0.52, 0.68, 0.66], folds: 0.22, inset: 0.02, tail: 0, band: 0.1, sleeve: 585, cuff: 0.7, collar: "crew", front: "none", waist: 0 },
  jacket: { neck: 70, slope: 54, thin: [0.32, 0.62, 0.72, 0.68], folds: 0.17, inset: 0.035, tail: 0, band: 0, sleeve: 610, cuff: 0.96, collar: "lapel", front: "open", waist: 0.03 },
  coat: { neck: 74, slope: 54, thin: [0.3, 0.58, 0.7, 0.7], folds: 0.2, inset: -0.02, tail: 0, band: 0, sleeve: 630, cuff: 0.98, collar: "lapel", front: "open", waist: 0.03 },
  dress: { neck: 78, slope: 44, thin: [0.28, 0.34, 0.5, 0.5], folds: 0.44, inset: -0.1, tail: 0, band: 0, sleeve: 0, cuff: 1, collar: "none", front: "none", waist: 0.13 },
};

/** de un borde al otro del paño, más juntos cerca de los bordes para que redondeen */
const PANEL = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map((k) => Math.sign(k) * (1 - Math.pow(1 - Math.abs(k) / 5, 1.5)));

function hungGarment(b: Builder, shape: Exclude<HungShape, "pants">, variant: number, size: number[]) {
  const cut = CUTS[shape];
  const spec = HUNG[shape];
  const [T, H, W] = size;
  const hx = T / 2;
  // en un placard playo la prenda va más angosta: la manga se achica con ella
  const out = spec.out * Math.min(1, W / spec.w);
  const hs = W / 2 - out;
  const yNeck = H / 2 - Math.max(0, spec.rise);
  const yS = yNeck - cut.slope;
  const yHem = -H / 2;
  const L = yS - yHem;
  const neck = Math.min(cut.neck, hs * 0.42);
  const ph = variant * 2.4 + shape.length;

  type Level = { y: number; zh: number; ht: number; t: number };
  const levels: Level[] = [];
  // del cuello a la punta del hombro: el ancho crece siguiendo la percha
  for (const f of [0, 0.14, 0.36, 0.62, 0.86, 1]) {
    levels.push({ y: yNeck - cut.slope * f, zh: neck + (hs - neck) * (1 - Math.pow(1 - f, 1.6)), ht: lerp(cut.thin[0], cut.thin[1], f) * hx, t: (f - 1) * 0.2 });
  }
  // y de ahí al ruedo: la tela cuelga
  for (const t of [0.06, 0.16, 0.3, 0.45, 0.6, 0.74, 0.87, 0.95, 1]) {
    const hang = cut.inset >= 0 ? cut.inset * smooth(t * 1.6) : cut.inset * Math.pow(t, 1.5);
    const band = cut.band * smooth((t - (1 - 70 / L)) / (30 / L));
    const waist = cut.waist * Math.exp(-Math.pow((t - 0.27) / 0.16, 2));
    levels.push({ y: yS - L * t, zh: hs * (1 - hang) * (1 - band) * (1 - waist) + 3 * Math.sin(t * 7 + ph), ht: hx * (t < 0.25 ? lerp(cut.thin[1], cut.thin[2], smooth(t / 0.25)) : lerp(cut.thin[2], cut.thin[3], (t - 0.25) / 0.75)), t });
  }
  const wave = (z: number, t: number, side: number) => 0.66 * Math.sin(z * 0.031 + ph * side + 0.5 * t + side) + 0.34 * Math.sin(z * 0.044 - ph + 2.1 * side - 0.9 * t);
  const amp = (t: number) => cut.folds * hx * (t <= 0 ? 0.1 : 0.12 + 0.88 * Math.pow(t, 0.7));
  /** un punto del paño de adelante (side 1) o de atrás (-1), en q de -1 a 1 de borde a borde */
  const point = (lv: Level, q: number, side: number): [V3, number] => {
    const z = lv.zh * q;
    const w = wave(z, lv.t, side);
    const x = Math.max(0.6 * (1 - Math.abs(q)), lv.ht * Math.sqrt(1 - Math.pow(Math.abs(q), 3.2)) + amp(lv.t) * w * (1 - Math.pow(q, 4)));
    // el ruedo no es una línea: sube en los costados (el faldón) y ondula con los pliegues
    const near = smooth((lv.t - 0.6) / 0.4);
    const y = lv.y + near * (cut.tail * q * q + 4 + 4 * Math.sin(q * 4.2 + ph * side));
    return [[side * x, y, z], 1 - 0.24 * Math.max(0, -w) * clamp01(lv.t * 3) * (1 - Math.pow(q, 4))];
  };
  const tones: number[][] = [];
  const rings = levels.map((lv) => {
    const ring: V3[] = [];
    const tone: number[] = [];
    for (const q of PANEL) {
      const [p, c] = point(lv, q, 1);
      ring.push(p);
      tone.push(c);
    }
    for (const q of PANEL.slice(1, -1).reverse()) {
      const [p, c] = point(lv, q, -1);
      ring.push(p);
      tone.push(c);
    }
    tones.push(tone);
    return ring;
  });
  // adentro del cuello y del ruedo se ve oscuro: es el revés, en sombra
  // (las tapas van hundidas: por el costado del ruedo no se ve un piso, se ve el hueco)
  loft(b, rings, { color: (i, j) => gray(tones[i][j]), caps: [gray(0.32), gray(0.45)], sag: [6, 70] });

  /** el nivel a una altura cualquiera, entre los dos que la encierran */
  const levelAt = (y: number): Level => {
    for (let i = 1; i < levels.length; i++) {
      if (y >= levels[i].y) {
        const [a, c] = [levels[i - 1], levels[i]];
        const k = (a.y - y) / Math.max(1e-6, a.y - c.y);
        return { y, zh: lerp(a.zh, c.zh, k), ht: lerp(a.ht, c.ht, k), t: lerp(a.t, c.t, k) };
      }
    }
    return levels[levels.length - 1];
  };
  /** un punto sobre el frente de la prenda, levantado `lift` mm */
  const onFront = (z: number, y: number, lift: number): V3 => {
    const lv = levelAt(y);
    const [p] = point({ ...lv, t: Math.min(lv.t, 0.59) }, clamp01(Math.abs(z) / lv.zh) * Math.sign(z), 1);
    return [p[0] + lift, y, z];
  };
  const tn = cut.thin[0] * hx;

  // el cuello
  if (cut.collar !== "none") {
    const n = 12;
    const shirt = cut.collar !== "crew";
    const leaf = cut.collar === "lapel" ? 26 : shirt ? 19 : 11;
    const ring = (rz: number, rx: number, y: (front: number) => number) =>
      Array.from({ length: n }, (_, j): V3 => {
        const s = (j / n) * 2 * Math.PI;
        // front: 1 adelante (donde abrocha), 0 atrás
        return [Math.min(hx - 0.4, rx) * Math.sin(s), y((1 + Math.sin(s)) / 2), rz * Math.cos(s)];
      });
    const rise = spec.rise;
    const collar = shirt
      ? [
          // la punta del cuello cae adelante y la tirilla es más alta atrás
          ring(neck + leaf, tn + (cut.collar === "lapel" ? 16 : 12), (f) => yNeck - 5 - (cut.collar === "lapel" ? 30 : 20) * f * f),
          ring(neck + 5, tn + 6, (f) => yNeck + rise * (1 - 0.4 * f)),
          ring(neck - 7, Math.max(2, tn - 2), () => yNeck + 3),
        ]
      : [
          // el cuello redondo de punto: más bajo adelante
          ring(neck + leaf, tn + 6, (f) => yNeck - 4 - 5 * f),
          ring(neck + 3, tn + 3, (f) => yNeck + rise * (1 - 0.75 * f)),
          ring(neck - 7, Math.max(2, tn - 3), (f) => yNeck + 2 - 3 * f),
        ];
    loft(b, collar, { color: (i) => gray(i === 2 ? 0.4 : i === 1 ? 0.97 : 0.92) });
  }

  // la tapeta con sus botones, o la abertura de un saco con sus solapas
  if (cut.front === "placket") {
    const ys: number[] = [];
    for (let y = yNeck - 26; y > yHem + 40; y -= 78) ys.push(y);
    ys.push(yHem + 8);
    loft(
      b,
      ys.map((y) => [onFront(-15, y, 0.1), onFront(-13.5, y, 1.3), onFront(13.5, y, 1.3), onFront(15, y, 0.1)]),
      { color: (_, j) => gray(j === 0 || j === 3 ? 0.86 : 0.99), open: true, out: [1, 0, 0] },
    );
    for (let y = yNeck - 58; y > yHem + 60; y -= 96) button(b, onFront(0, y, 1.3), 5.2, gray(0.72));
  } else if (cut.front === "open") {
    const top = yNeck - 250;
    const ys: number[] = [];
    for (let y = top; y > yHem + 30; y -= 60) ys.push(y);
    ys.push(yHem + 6);
    // el cruce de los delanteros: una línea de sombra
    loft(
      b,
      ys.map((y) => [onFront(-2.2, y, 0.9), onFront(2.2, y, 0.9)]),
      { color: gray(0.42), open: true, out: [1, 0, 0] },
    );
    for (const s of [-1, 1]) {
      // la solapa: un triángulo que baja del cuello al primer botón
      const pts: V3[] = [onFront(s * neck * 0.55, yNeck - 34, 2.4), onFront(s * (neck + 8), yNeck - 118, 2.4), onFront(s * 3, top, 2.4)];
      loft(b, [[pts[0], pts[1]], [pts[0], pts[2]]], { color: gray(0.93), open: true, out: [1, 0, 0] });
    }
    for (const y of [top - 28, top - 128]) if (y > yHem + 80) button(b, onFront(9, y, 1.4), 9, gray(0.5));
  }

  // las mangas
  if (cut.sleeve !== 0) {
    const bs = cut.thin[1] * hx * 0.92;
    const swings = [
      [0.34, -0.22],
      [-0.3, 0.3],
      [0.16, 0.4],
    ][variant % 3];
    for (const [k, side] of [1, -1].entries()) {
      const swing = swings[k] * hx;
      const rows: V3[][] = [];
      if (cut.sleeve > 0) {
        // larga: cae derecha desde el hombro, apenas abierta, y termina en el puño
        const len = Math.min(cut.sleeve, L - 70);
        const widths: [number, number][] = [[0, 5], [0.04, 34], [0.12, 62], [0.25, Math.min(78, hs * 0.36)], [0.6, 66], [0.9, 56], [0.915, 56 * cut.cuff], [1, 53 * cut.cuff]];
        const thick: [number, number][] = [[0, 3], [0.04, 0.6 * bs], [0.12, bs], [0.6, 0.9 * bs], [0.9, 0.84 * bs], [0.915, 0.8 * bs * (cut.cuff < 0.9 ? 0.86 : 1)], [1, 0.78 * bs]];
        for (const t of [0, 0.05, 0.16, 0.38, 0.64, 0.9, 0.915, 1]) {
          const a = keyed(widths, t);
          const bb = keyed(thick, t) * (1 + 0.1 * Math.sin(t * 11 + ph + k));
          const zo = hs - 2 + (out - 3) * smooth(t * 2.5);
          const xc = Math.sign(swing) * Math.min(Math.abs(swing) * Math.pow(t, 1.2), hx - bb - 0.5);
          rows.push(ellipse([xc, yS + 4 - len * t, side * (zo - a)], [0, 0, side], [1, 0, 0], a, bb, 8, 0.8));
        }
      } else {
        // corta: sigue la caída del hombro y termina abierta
        const d: V3 = [0, -0.94, 0.34 * side];
        const nrm: V3 = [0, 0.34, 0.94 * side];
        const e0: V3 = [0, yS + 6, side * (hs - 14)];
        const reach = Math.min(150, (out + 12) / 0.34);
        for (const [s, a, k2] of [
          [0, 84, 1],
          [0.4 * reach, 82, 1],
          [0.75 * reach, 78, 0.95],
          [0.97 * reach, 75, 0.88],
          [reach, 73, 0.84],
        ]) {
          const xc = swing * 0.5 * (s / reach);
          const c: V3 = [xc, e0[1] - a * nrm[1] + (s - 10) * d[1], e0[2] - a * nrm[2] + (s - 10) * d[2]];
          rows.push(ellipse(c, nrm, [1, 0, 0], a, bs * k2, 8, 0.8));
        }
      }
      loft(b, rows, { color: (i) => gray(cut.sleeve > 0 && i >= rows.length - 2 ? 0.95 : 1), caps: [cut.sleeve > 0 ? WHITE : null, gray(0.36)] });
    }
  }
}

/** un botón: un disco apoyado sobre el frente de la prenda */
function button(b: Builder, at: V3, r: number, color: RGB) {
  const ring = (lift: number, k: number) => ellipse([at[0] + lift, at[1], at[2]], [0, 0, 1], [0, 1, 0], r * k, r * k, 5);
  loft(b, [ring(-0.6, 1), ring(1.1, 0.9)], { color, caps: [null, shade(color, 0.9)] });
}

/** un pantalón doblado por la rodilla sobre la varilla de la percha: cae a los dos lados */
function pants(b: Builder, variant: number, size: number[]) {
  const [T, H, W] = size;
  const th = 15;
  const R = 6 + 2 + th / 2;
  const yb = H / 2 - R - th / 2;
  const hw = W / 2;
  const ph = variant * 1.9;
  // el lado de la cintura (más ancho, llega hasta abajo) y el de las botamangas (más corto y angosto)
  const lenA = yb + H / 2;
  const lenB = lenA - [44, 70, 22][variant % 3];
  type Station = { c: [number, number]; n: [number, number]; hw: number; th: number; t: number; tone: number };
  const stations: Station[] = [];
  const flare = Math.max(0, T / 2 - R - th / 2 - 4);
  for (const f of [1, 0.92, 0.62, 0.3, 0.08]) {
    // la cintura: una franja más gruesa en la punta
    const waist = f > 0.9;
    stations.push({ c: [R + flare * f * f, yb - lenA * f], n: [1, 0], hw: lerp(hw * 0.9, hw - 2, smooth(f * 1.4)), th: th + (waist ? 2.6 : 0), t: f, tone: waist ? 0.92 : 1 });
  }
  for (let k = 0; k <= 4; k++) {
    const a = (k / 4) * Math.PI;
    stations.push({ c: [R * Math.cos(a), yb + R * Math.sin(a)], n: [Math.cos(a), Math.sin(a)], hw: hw * 0.9, th, t: 0, tone: 1 });
  }
  for (const f of [0.08, 0.3, 0.62, 0.93, 1]) {
    stations.push({ c: [-R - flare * 0.7 * f * f, yb - lenB * f], n: [-1, 0], hw: lerp(hw * 0.9, hw * 0.7, f), th: th - 1.5 * f, t: f, tone: f > 0.95 ? 0.94 : 1 });
  }
  const rings = stations.map((s) => {
    const ring: V3[] = [];
    const at = (q: number, side: number): V3 => {
      const z = s.hw * q;
      // unas ondas suaves a lo largo de la pierna, que crecen hacia abajo
      const off = side * (s.th / 2) * Math.sqrt(1 - Math.pow(Math.abs(q), 5)) + 2.6 * s.t * Math.sin(z * 0.041 + ph + s.n[0]);
      return [s.c[0] + s.n[0] * off, s.c[1] + s.n[1] * off, z];
    };
    for (const q of PANEL) if (Math.abs(q) < 0.999 || q < 0) ring.push(at(q, 1));
    for (const q of [...PANEL].reverse()) if (Math.abs(q) < 0.999 || q > 0) ring.push(at(q, -1));
    return ring;
  });
  loft(b, rings, { color: (i) => gray(stations[i].tone), caps: [gray(0.5), gray(0.42)] });
}

// ---------------------------------------------------------------------------
// La percha

function hanger(b: Builder, variant: number, size: number[], colors: string[] = []) {
  const [, H, W] = size;
  const body = rgb(colors[0] ?? "#d2b48a");
  const steel = rgb(colors[1] ?? "#b9bcc0");
  const slim = variant === 1;
  const hw = W / 2 - 1;
  const yRod = H / 2 - HANGER.hookTop;
  const yNeck = yRod - HANGER.neck;
  // los brazos: una barra que baja del cuello a las puntas, más fina en la punta
  const tx = slim ? 2.6 : HANGER.thick / 2 - 1;
  const rows: V3[][] = [];
  for (const u of [-1, -0.96, -0.7, -0.4, -0.13, 0, 0.13, 0.4, 0.7, 0.96, 1]) {
    const a = Math.abs(u);
    const top = yNeck - HANGER.drop * Math.pow(a, 1.35) + (slim ? 0 : 5 * Math.pow(1 - a, 3));
    const tall = (slim ? 11 : lerp(HANGER.arm, 15, a)) * (a === 1 ? 0.55 : 1);
    rows.push(ellipse([0, top - tall / 2 - (a === 1 ? 2 : 0), u * hw], [1, 0, 0], [0, 1, 0], tx * (a === 1 ? 0.6 : 1), tall / 2, 6, slim ? 0.7 : 0.62));
  }
  loft(b, rows, { color: body, caps: [body, body] });
  // la varilla de los pantalones
  if (variant >= 1) {
    const y = yNeck - HANGER.bar;
    const r = slim ? 3 : 6;
    const z = hw - (slim ? 14 : 10);
    loft(b, [-1, 1].map((s) => ellipse([0, y, s * z], [1, 0, 0], [0, 1, 0], Math.min(r, tx + 2.5), r, 6)), { color: body, caps: [body, body] });
    if (slim) for (const s of [-1, 1]) loft(b, [yNeck - HANGER.drop * 0.9, y].map((yy) => ellipse([0, yy, s * z], [1, 0, 0], [0, 0, 1], 2.2, 3.4, 6)), { color: body });
  }
  // el gancho: un alambre que abraza el barral y baja al cuello de la percha
  const path: [number, number][] = [];
  for (let a = 205; a >= -35; a -= 30) path.push([20.5 * Math.cos((a * Math.PI) / 180), yRod + 14.6 * Math.sin((a * Math.PI) / 180)]);
  path.push([12, yRod - 15.5], [5.5, yRod - 23], [1.2, yRod - 30], [0, yRod - 37], [0, yNeck - 6]);
  const wire = slim ? 1.7 : 2;
  const hook = path.map(([z, y], i): V3[] => {
    const [pz, py] = path[Math.max(0, i - 1)];
    const [nz, ny] = path[Math.min(path.length - 1, i + 1)];
    const l = Math.hypot(nz - pz, ny - py) || 1;
    // en el plano de la percha, perpendicular al recorrido
    const side: V3 = [0, (nz - pz) / l, -(ny - py) / l];
    return ellipse([0, y, z], [1, 0, 0], side, wire, wire, 5);
  });
  loft(b, hook, { color: steel, caps: [steel, null] });
}

// ---------------------------------------------------------------------------
// La ropa doblada

/**
 * Una prenda doblada: el doblez redondo al frente, los costados con la línea
 * entre capa y capa y arriba unas arrugas suaves. `type`: 0 remera, 1 jean, 2
 * buzo o manta.
 */
function folded(b: Builder, variant: number, size: number[]) {
  const [W, H, D] = size;
  const type = Math.floor(variant / 4);
  const ph = (variant % 4) * 1.7 + type;
  const [hw, hh, hd] = [W / 2, H / 2, D / 2];
  // el contorno, visto de costado (z, y): el doblez adelante, la espalda atrás
  const rf = hh * (type === 1 ? 0.92 : 1);
  const profile: [number, number, number][] = [];
  // [z, y, cuánto es "arriba": ahí van las arrugas]
  for (const a of [-90, -52, -18, 18, 52, 90]) profile.push([hd - rf + rf * Math.cos((a * Math.PI) / 180), rf * Math.sin((a * Math.PI) / 180), a > 60 ? 1 : 0]);
  for (const f of [0.26, 0.5, 0.74]) profile.push([lerp(hd - rf, -hd + hh * 0.5, f), hh * (1 - 0.1 * f), 1]);
  // atrás, más fino: se ven los bordes de la tela
  const back = hh * 0.82;
  profile.push([-hd + back * 0.45, back, 1], [-hd + back * 0.1, back * 0.55, 0], [-hd + back * 0.2, 0, 0], [-hd + back * 0.1, -back * 0.55, 0], [-hd + back * 0.45, -hh, 0]);
  for (const f of [0.74, 0.4]) profile.push([lerp(hd - rf, -hd + hh * 0.5, f), -hh, 0]);
  const layers = type === 1 ? 2 : 1;
  // cuánto se mete el costado a cada altura: la raya entre capas
  const notch = (y: number) => {
    let v = 0;
    for (let k = 1; k <= layers; k++) v += Math.exp(-Math.pow((y - hh * (-1 + (2 * k) / (layers + 1))) / (hh * 0.16), 2));
    return v;
  };
  const rr = Math.min(hh * (type === 2 ? 1.15 : 0.9), hw * 0.3);
  const ends = [0.05, 0.28, 0.62, 1];
  const stations: { x: number; k: number; e: number }[] = [];
  for (const e of ends) stations.push({ x: -hw + rr * e, k: Math.sqrt(1 - Math.pow(1 - e, 2)), e: 1 - e });
  for (const f of [0.3, 0.5, 0.7]) stations.push({ x: lerp(-hw + rr, hw - rr, f), k: 1, e: 0 });
  for (const e of [...ends].reverse()) stations.push({ x: hw - rr * e, k: Math.sqrt(1 - Math.pow(1 - e, 2)), e: 1 - e });
  const puff = type === 2 ? 3.5 : type === 1 ? 1 : 2;
  const tones: number[][] = [];
  const rings = stations.map((s) => {
    const tone: number[] = [];
    const ring = profile.map(([z, y, up]): V3 => {
      const nk = notch(y) * s.e;
      const wr = up * (puff * (1 - Math.pow(s.x / hw, 2)) * 0.6 + (type === 1 ? 0.8 : 1.6) * Math.sin(s.x * 0.045 + z * 0.021 + ph) + 1.1 * Math.sin(z * 0.06 - s.x * 0.02 + ph * 2)) * s.k;
      tone.push(1 - 0.5 * nk);
      // hacia el costado la sección se cierra (un canto redondo), menos donde está la raya
      // (las arrugas de arriba van hacia abajo del tope de la caja: la prenda de encima apoya)
      return [s.x - Math.sign(s.x) * nk * rr * 0.26, (y + (up ? Math.min(wr, puff + 2) - puff - 2 : 0)) * (0.25 + 0.75 * s.k), z * (0.9 + 0.1 * s.k)];
    });
    tones.push(tone);
    return ring;
  });
  loft(b, rings, { color: (i, j) => gray(tones[i][j]), caps: [gray(0.8), gray(0.8)] });
}

// ---------------------------------------------------------------------------
// El calzado

type Last = {
  /** altura de la suela en el talón y en la punta, y cuánto levanta la punta */
  sole: [number, number];
  spring: number;
  /** el taco: hasta dónde llega (0 a 1 del largo) y cuánto sube el arco después */
  heel: number;
  arch: number;
  /** la boca: de dónde a dónde (0 a 1), y la altura del borde atrás, al costado y adelante */
  mouth: [number, number];
  rim: [number, number, number];
  /** el empeine, de la lengüeta a la punta: (dónde, altura) */
  vamp: [number, number][];
  /** puntera de goma, cordones */
  toecap: boolean;
  laces: number;
};

const LASTS: Last[] = [
  // zapatilla de lona
  { sole: [30, 25], spring: 9, heel: 0, arch: 0, mouth: [0.03, 0.4], rim: [0.95, 0.76, 0.99], vamp: [[0.4, 0.99], [0.5, 0.8], [0.62, 0.64], [0.74, 0.53], [0.84, 0.47], [0.92, 0.42], [0.97, 0.36], [1, 0.27]], toecap: true, laces: 5 },
  // zapato de cuero
  { sole: [24, 9], spring: 5, heel: 0.23, arch: 10, mouth: [0.04, 0.42], rim: [0.96, 0.78, 0.99], vamp: [[0.42, 0.99], [0.52, 0.83], [0.64, 0.69], [0.76, 0.58], [0.86, 0.51], [0.93, 0.46], [0.975, 0.36], [1, 0.2]], toecap: false, laces: 4 },
  // botita
  { sole: [28, 19], spring: 7, heel: 0.22, arch: 5, mouth: [0.03, 0.36], rim: [0.98, 0.94, 0.99], vamp: [[0.36, 0.99], [0.42, 0.7], [0.52, 0.52], [0.64, 0.42], [0.76, 0.36], [0.86, 0.32], [0.93, 0.28], [0.975, 0.22], [1, 0.13]], toecap: false, laces: 0 },
];

/** un zapato, con la punta hacia +z. `variant`: el modelo por dos, más uno si es el pie derecho */
function shoe(b: Builder, variant: number, size: number[], colors: string[] = []) {
  const [W, H, Len] = size;
  const last = LASTS[Math.floor(variant / 2) % LASTS.length];
  const m = variant % 2 ? 1 : -1;
  const upper = rgb(colors[0] ?? "#f1efea");
  const sole = rgb(colors[1] ?? "#f6f4ef");
  const lace = rgb(colors[2] ?? "#e9e6df");
  const lining = shade(upper, 0.22);
  const half = W / 2 - 4.5;
  const plan: [number, number][] = [[0, 0.1], [0.015, 0.42], [0.05, 0.62], [0.12, 0.72], [0.22, 0.75], [0.34, 0.77], [0.46, 0.85], [0.58, 0.96], [0.7, 1], [0.8, 0.97], [0.88, 0.86], [0.94, 0.67], [0.98, 0.42], [1, 0.1]];
  const ss = [0, 0.02, 0.07, 0.16, 0.28, 0.4, 0.52, 0.64, 0.76, 0.855, 0.865, 0.93, 0.98, 1];
  const [m0, m1] = last.mouth;
  const tones: RGB[][] = [];
  const rings = ss.map((s) => {
    const z = (s - 0.5) * Len;
    const hw = keyed(plan, s) * half;
    // el pie no es simétrico: la punta tira hacia adentro
    const cx = m * (-2.5 + 6.5 * s * s) * (s < 1 ? 1 : 0.4);
    const lift = last.spring * Math.pow(clamp01((s - 0.7) / 0.3), 2);
    const arch = last.heel ? last.arch * smooth((s - last.heel) / 0.06) * (1 - smooth((s - 0.5) / 0.14)) : 0;
    const yb = lift + arch;
    const th = last.heel ? lerp(last.sole[0], last.sole[1], smooth((s - last.heel) / 0.05)) : lerp(last.sole[0], last.sole[1], s);
    const yst = yb + Math.max(4, th - arch);
    const open = s > m0 && s < m1;
    // la altura de la capellada: el borde de la boca, o el empeine que baja a la punta
    const k = (s - m0) / (m1 - m0);
    const top = H * (s <= m0 ? lerp(last.rim[0] * 0.86, last.rim[0], s / m0) : open ? (k < 0.5 ? lerp(last.rim[0], last.rim[1], smooth(k * 2)) : lerp(last.rim[1], last.rim[2], smooth(k * 2 - 1))) : keyed(last.vamp, s));
    const hb = Math.max(0.5, hw - 3.2);
    const ring: V3[] = [];
    const tone: RGB[] = [];
    const add = (x: number, y: number, c: RGB) => {
      ring.push([cx + x, Math.min(H, y) - H / 2, z]);
      tone.push(c);
    };
    const rubber = last.toecap && s > 0.86;
    const outsole = shade(sole, last.heel ? 1 : 0.78);
    add(-hw * 0.62, yb, outsole);
    add(hw * 0.62, yb, outsole);
    add(hw, yb + 3, outsole);
    add(hw, yst - 2.5, sole);
    add(hb + 0.4, yst, sole);
    add(hb, yst + 1.2, rubber ? sole : upper);
    // el arco de la capellada, de un costado al otro
    for (let i = 0; i < 9; i++) {
      const a = ((8 + (164 * i) / 8) * Math.PI) / 180;
      const x = hb * spow(Math.cos(a), 0.72);
      let y = yst + (top - yst) * Math.pow(Math.sin(a), 0.66);
      let c = rubber ? sole : upper;
      if (open && i >= 3 && i <= 5) {
        // la boca: el borde acolchado y, adentro, el forro en sombra
        y = i === 4 ? top - Math.min(26, (top - yst) * 0.45) : top;
        c = i === 4 ? lining : shade(upper, 0.9);
      }
      add(x, y, c);
    }
    add(-hb, yst + 1.2, rubber ? sole : upper);
    add(-hb - 0.4, yst, sole);
    add(-hw, yst - 2.5, sole);
    add(-hw, yb + 3, outsole);
    tones.push(tone);
    return ring;
  });
  loft(b, rings, { color: (i, j) => tones[i][j], caps: [upper, last.toecap ? sole : upper] });
  // los cordones: unas tiras cruzadas sobre el empeine
  for (let i = 0; i < last.laces; i++) {
    const s = lerp(m1 + 0.035, 0.7, i / Math.max(1, last.laces - 1));
    const top = H * keyed(last.vamp, s);
    plate(b, [m * (-2.5 + 6.5 * s * s), top - H / 2 + 0.2, (s - 0.5) * Len], [keyed(plan, s) * half * 0.62, 3, 5], lace);
  }
}

// ---------------------------------------------------------------------------
// El guardado

/**
 * Una caja de tela. Variante 0, con portaetiqueta; 1, con manija; 2, chata con
 * tapa. Colores: el cuerpo y el de la manija o el marco de la etiqueta.
 */
function box(b: Builder, variant: number, size: number[], colors: string[] = []) {
  const [W, H, D] = size;
  const body = rgb(colors[0] ?? "#eeeae2");
  const accent = rgb(colors[1] ?? "#8f8a80");
  const [hx, hy, hz] = [W / 2, H / 2, D / 2];
  const lid = variant === 2 ? Math.min(46, H * 0.4) : Math.min(34, H * 0.2);
  const over = variant === 2 ? 2.5 : 0;
  // el cuerpo va apenas metido en su caja: lo que sobresale del frente (la manija, la etiqueta) queda adentro
  const in0 = over + [3, 5, 2][variant % 3];
  const ring = (inset: number, y: number) => roundRect(hx - inset, hz - inset, 9, y, 4);
  // el cuerpo: los cantos apenas redondeados, como la tela sobre el cartón
  const levels: [number, number, number][] = [
    [in0 + 5, -hy, 0.92],
    [in0 + 1, -hy + 2, 0.97],
    [in0, -hy + 7, 1],
    [in0, hy - lid, 1],
  ];
  loft(b, levels.map(([i, y]) => ring(i, y)), { color: (i) => shade(body, levels[i][2]), caps: [shade(body, 0.8), null] });
  // la tapa: sobresale apenas y arriba se hunde un poco en el medio
  const top: [number, number, number][] = [
    [in0 + 0.6, hy - lid - 0.5, 0.74],
    [in0 - over, hy - lid, 0.96],
    [in0 - over, hy - 6, 1],
    [in0 - over + 1.5, hy - 1.5, 1],
    [in0 - over + 6, hy, 0.98],
  ];
  loft(b, top.map(([i, y]) => ring(i, y)), { color: (i) => shade(body, top[i][2]), caps: [null, shade(body, 0.97)], sag: 2.5 });
  const face = hz - in0;
  const y = variant === 2 ? -lid / 2 : -lid / 2 + H * 0.04;
  if (variant === 0) {
    // portaetiqueta: un marco con su cartón blanco
    plate(b, [0, y, face + 0.9], [86, 44, 1.8], accent);
    plate(b, [0, y, face + 1.9], [74, 32, 0.8], rgb("#f6f4ee"));
  } else if (variant === 1) {
    // manija: una tira tomada por dos presillas
    plate(b, [0, y, face + 3], [118, 20, 3.2], accent);
    for (const s of [-1, 1]) plate(b, [s * 58, y, face + 2.2], [16, 30, 4.4], shade(accent, 0.86));
  } else {
    // ojal de metal para tirar
    plate(b, [0, y, face + 0.8], [54, 22, 1.6], accent);
    plate(b, [0, y, face + 1.4], [40, 10, 0.8], gray(0.06));
  }
}

/** un canasto de fibra tejida: más angosto abajo, con el borde enrollado y dos agarraderas */
function basket(b: Builder, variant: number, size: number[], colors: string[] = []) {
  const [W, H, D] = size;
  const fiber = rgb(colors[0] ?? "#c2a374");
  const [hx, hy, hz] = [W / 2 - 5, H / 2, D / 2 - 5];
  const n = 6;
  const rows = 8;
  const wall = H * 0.93;
  const corner = Math.min(hx, hz) * (variant === 1 ? 0.75 : 0.5);
  type Lv = { y: number; out: number; tone: number; weave: number };
  const lv: Lv[] = [{ y: 0, out: -7, tone: 0.8, weave: 0 }];
  for (let r = 0; r < rows; r++) {
    lv.push({ y: (wall * (r + 0.08)) / rows, out: 0, tone: 0.66, weave: 0 });
    lv.push({ y: (wall * (r + 0.5)) / rows, out: 0, tone: 1, weave: r % 2 ? 1 : -1 });
  }
  lv.push({ y: wall, out: 0, tone: 0.7, weave: 0 }, { y: lerp(wall, H, 0.4), out: 4.5, tone: 1, weave: 0 }, { y: H, out: 0.5, tone: 0.96, weave: 0 }, { y: H - 4, out: -8, tone: 0.62, weave: 0 }, { y: H * 0.62, out: -10, tone: 0.4, weave: 0 }, { y: H * 0.34, out: -10, tone: 0.26, weave: 0 });
  const tones: number[][] = [];
  const rings = lv.map((l) => {
    const k = 0.87 + 0.13 * Math.pow(l.y / H, 0.8);
    const tone: number[] = [];
    const ring = roundRect(hx * k, hz * k, corner * k, l.y - hy, n).map((p, j): V3 => {
      // el tejido: cada vuelta pasa por delante de una costilla sí y una no
      const bump = l.weave ? ((j + (l.weave > 0 ? 1 : 0)) % 2 ? 3.6 : 1) : 0;
      const d = Math.hypot(p[0], p[2]) || 1;
      const o = l.out + bump;
      tone.push(l.tone * (l.weave && bump < 2 ? 0.86 : 1));
      return [p[0] + (p[0] / d) * o, p[1], p[2] + (p[2] / d) * o];
    });
    tones.push(tone);
    return ring;
  });
  loft(b, rings, { color: (i, j) => shade(fiber, tones[i][j]), caps: [shade(fiber, 0.7), shade(fiber, 0.2)] });
  // las agarraderas: un hueco a cada costado
  for (const s of [-1, 1]) plate(b, [s * (hx * 0.985 + 2.2), hy - H * 0.2, 0], [1.6, 24, Math.min(90, D * 0.34)], shade(fiber, 0.16));
}

// ---------------------------------------------------------------------------

/** la trama de cada cosa respecto de la foto de la tela (que está agrandada para tapizados) */
const WEAVE: Partial<Record<GarmentShape, number>> = { shirt: 3.2, tee: 3.2, dress: 3.2, pants: 2.6, jacket: 2.2, coat: 1.8, sweater: 1.3, box: 1.6 };

function build(shape: GarmentShape, variant: number, size: number[], colors?: string[]): THREE.BufferGeometry {
  const b = new Builder(shape === "folded" ? [3.2, 2.6, 1.3][Math.floor(variant / 4)] ?? 1.3 : (WEAVE[shape] ?? 1));
  switch (shape) {
    case "pants":
      pants(b, variant, size);
      break;
    case "hanger":
      hanger(b, variant, size, colors);
      break;
    case "folded":
      folded(b, variant, size);
      break;
    case "shoe":
      shoe(b, variant, size, colors);
      break;
    case "box":
      box(b, variant, size, colors);
      break;
    case "basket":
      basket(b, variant, size, colors);
      break;
    default:
      hungGarment(b, shape, variant, size);
  }
  return b.geometry();
}

const cache = new Map<string, THREE.BufferGeometry>();

/**
 * La geometría de una prenda o un accesorio, a la medida de su caja (mm) y
 * centrada en ella. Se comparte entre todas las piezas iguales: no hay que
 * liberarla al desmontar una (`userData.shared`).
 */
export function garmentGeometry(garment: { shape: GarmentShape; variant: number; colors?: string[] }, size: number[]): THREE.BufferGeometry {
  const dims = size.map((v) => Math.max(1, Math.round(v)));
  const key = `${garment.shape}:${garment.variant}:${dims.join("x")}:${garment.colors?.join(",") ?? ""}`;
  let g = cache.get(key);
  if (!g) {
    g = build(garment.shape, garment.variant, dims, garment.colors);
    g.userData.shared = true;
    cache.set(key, g);
  }
  return g;
}
