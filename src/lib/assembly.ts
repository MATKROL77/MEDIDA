/**
 * Arma el placard pieza por pieza.
 *
 * De acá salen a la vez el modelo 3D y el despiece: cada pieza trae su caja en
 * el espacio (para dibujarla) y su medida de corte (para la seccionadora). Por
 * eso lo que el cliente ve es exactamente lo que el taller corta.
 *
 * Cada pieza tiene un id estable ("r0:m1:s2" es el segundo estante del módulo
 * 1 del tramo de frente). El 3D usa ese id para animar la misma pieza de una
 * medida a la otra en vez de reemplazarla: así todo se estira con resorte.
 *
 * Coordenadas en mm, locales a cada tramo: x a lo largo del tramo, y hacia
 * arriba, z hacia el frente. El fondo del tramo está en z = 0. El tramo
 * lateral de un placard en L se arma igual y después se gira 90°.
 *
 * Construcción: laterales y divisores pasantes de piso a techo, techo y piso
 * por módulo entre ellos. Así ninguna pieza horizontal supera el ancho de un
 * módulo y todo entra en una placa estándar, aunque el placard mida 4 metros.
 */

import { catalog } from "./catalog.ts";
import {
  CURVE_RADIUS,
  DRAWER_PITCH,
  PLINTH_HEIGHT,
  TOP_SHELF_DROP,
  cornerModule,
  drawerZone,
  heightAt,
  moduleOffsets,
  runSpan,
  type WardrobeConfig,
} from "./model.ts";

export type Vec3 = [number, number, number];

export type PartKind =
  | "side"
  | "divider"
  | "top"
  | "bottom"
  | "plinth"
  | "back"
  | "shelf"
  | "fixed-shelf"
  | "rod"
  | "drawer-front"
  | "drawer-side"
  | "drawer-end"
  | "drawer-bottom"
  | "door"
  | "sliding-door"
  | "blind"
  | "curved-shelf"
  | "handle"
  | "groove"
  | "mirror"
  | "glass"
  | "frame"
  | "led"
  | "glow";

export type Geometry = "box" | "trapezoid" | "quarter" | "knob" | "glow" | "none";

export type Cut = {
  /** largo en el sentido de la veta */
  length: number;
  width: number;
  thickness: number;
  /** cuántos lados largos y cortos llevan tapacanto */
  band: { long: 0 | 1 | 2; short: 0 | 1 | 2 };
  /** canto curvo, en mm, para los terminales */
  curvedBand?: number;
  /** aclaración para el taller: ángulos, curvas, trapecios */
  note?: string;
};

export type Part = {
  id: string;
  label: string;
  kind: PartKind;
  /** id de material del catálogo, o "back", "metal", "mirror", "glass", "led", "glow" */
  material: string;
  run: number;
  module: number | null;
  /** caja sin rotar: esquina mínima y tamaño, en mm */
  position: Vec3;
  size: Vec3;
  /** giro sobre su centro, en radianes (techos inclinados) */
  rotationZ?: number;
  geometry: Geometry;
  /** trapecio: alto a la izquierda y a la derecha; size[1] es el mayor */
  trapezoid?: { left: number; right: number };
  /** cuarto de elipse: hacia qué lado del tramo sale */
  quarter?: "left" | "right";
  /** tarjeta de luz: hacia dónde mira */
  glow?: "x+" | "x-" | "y" | "z";
  /** null para lo que no sale de placa */
  cut: Cut | null;
  /** las puertas batientes giran sobre este borde al abrir */
  hinge?: "left" | "right";
  /** herrajes y terminaciones que se mueven con la pieza, en coordenadas de la pieza */
  details?: Part[];
  /** desplazamiento al abrir (cajones y hojas corredizas), en mm */
  openShift?: Vec3;
  /** desplazamiento en la vista explotada, en mm */
  explode: Vec3;
  /** frentes: se vuelven translúcidos en la vista de rayos X */
  front?: boolean;
};

export type HardwareKey =
  | "hinge"
  | "slidePair"
  | "rod"
  | "rodSupport"
  | "slidingKit"
  | "slidingTrack"
  | "handle"
  | "fittings"
  | "mirror"
  | "glass"
  | "frameProfile"
  | "grooving"
  | "ledStrip"
  | "ledProfile"
  | "powerSupply"
  | "sensor"
  | "rgbController";

export type HardwareLine = {
  key: HardwareKey;
  label: string;
  qty: number;
  unit: "u" | "m" | "m²";
};

export type RunAssembly = {
  index: number;
  /** giro del tramo alrededor del eje vertical y dónde queda su origen */
  rotationY: number;
  offset: Vec3;
  span: number;
  parts: Part[];
};

export type Assembly = {
  runs: RunAssembly[];
  hardware: HardwareLine[];
  counts: { modules: number; doors: number; drawers: number; angledCuts: number; curvedCuts: number };
  ledMeters: number;
  /** caja que encierra todo el placard, en coordenadas de mundo (mm) */
  bounds: { min: Vec3; max: Vec3 };
};

/** bisagras por puerta según su alto: lo que recomiendan los fabricantes de herrajes */
export function hingesFor(doorHeight: number): number {
  if (doorHeight <= 900) return 2;
  if (doorHeight <= 1600) return 3;
  if (doorHeight <= 2000) return 4;
  return 5;
}

/** hojas corredizas según el ancho a cubrir */
export function slidingLeaves(width: number): number {
  if (width <= 1800) return 2;
  if (width <= 2700) return 3;
  return 4;
}

const SLIDING_OVERLAP = 40;
/** lo que ocupan los rieles adelante en un placard corredizo */
const SLIDING_RESERVE = 90;
/** retiro de los estantes para que la puerta batiente cierre sin tocar */
const HINGED_SETBACK = 20;
const DOOR_GAP = 3;
const deg = (rad: number) => Math.round((Math.abs(rad) * 180) / Math.PI);

/** perímetro de un cuarto de elipse (Ramanujan) */
function quarterEllipse(a: number, b: number): number {
  return (Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))) / 4;
}

type Ctx = {
  config: WardrobeConfig;
  hw: Record<HardwareKey, HardwareLine>;
  counts: Assembly["counts"];
  ledMeters: number;
  litModules: number;
};

/** terminaciones y tirador de un frente, en coordenadas del frente */
function frontDetails(ctx: Ctx, id: string, w: number, h: { left: number; right: number }, handleAt: "left" | "right" | "drawer" | null): Part[] {
  const { config } = ctx;
  const t = catalog.board.thickness;
  const hMax = Math.max(h.left, h.right);
  const hMin = Math.min(h.left, h.right);
  const sloped = h.left !== h.right;
  const out: Part[] = [];
  const detail = (p: Omit<Part, "run" | "module" | "explode" | "cut"> & { cut?: Cut | null }) =>
    out.push({ run: 0, module: null, explode: [0, 0, 0], cut: null, ...p });
  let faceZ: number = t;

  if (config.doorStyle === "grooved" && handleAt !== "drawer") {
    const pitch = 60;
    const count = Math.max(2, Math.floor((w - 80) / pitch));
    const first = (w - (count - 1) * pitch) / 2;
    for (let i = 0; i < count; i++) {
      const x = first + i * pitch;
      // con pendiente cada ranura llega hasta donde llega la puerta en su lugar
      const hx = h.left + ((h.right - h.left) * x) / w;
      detail({
        id: `${id}:g${i}`,
        label: "Ranura",
        kind: "groove",
        material: "groove",
        position: [x - 2.5, 70, t],
        size: [5, hx - 140, 0.8],
        geometry: "box",
      });
    }
    ctx.hw.grooving.qty += 1;
  }

  if (config.doorStyle === "mirror" && handleAt !== "drawer") {
    detail({
      id: `${id}:mirror`,
      label: "Espejo",
      kind: "mirror",
      material: "mirror",
      position: [4, 4, t],
      size: [w - 8, hMax - 8, 4],
      geometry: sloped ? "trapezoid" : "box",
      trapezoid: sloped ? { left: h.left - 8, right: h.right - 8 } : undefined,
    });
    ctx.hw.mirror.qty += ((w - 8) * (hMax - 8)) / 1e6;
    faceZ = t + 4;
  }

  if (config.doorStyle === "glass" && handleAt !== "drawer") {
    const bar = 22;
    const deep = 20;
    detail({ id: `${id}:fl`, label: "Perfil", kind: "frame", material: "metal", position: [0, 0, 0], size: [bar, hMax, deep], geometry: "box" });
    detail({ id: `${id}:fr`, label: "Perfil", kind: "frame", material: "metal", position: [w - bar, 0, 0], size: [bar, hMax, deep], geometry: "box" });
    detail({ id: `${id}:fb`, label: "Perfil", kind: "frame", material: "metal", position: [bar, 0, 0], size: [w - 2 * bar, bar, deep], geometry: "box" });
    detail({ id: `${id}:ft`, label: "Perfil", kind: "frame", material: "metal", position: [bar, hMax - bar, 0], size: [w - 2 * bar, bar, deep], geometry: "box" });
    detail({ id: `${id}:glass`, label: "Vidrio", kind: "glass", material: "glass", position: [bar, bar, 8], size: [w - 2 * bar, hMax - 2 * bar, 4], geometry: "box" });
    ctx.hw.glass.qty += ((w - 2 * bar) * (hMax - 2 * bar)) / 1e6;
    ctx.hw.frameProfile.qty += (2 * (w + hMax)) / 1000;
    faceZ = deep;
  }

  if (handleAt && config.handle !== "none") {
    const drawer = handleAt === "drawer";
    const len = drawer ? Math.min(220, w * 0.4) : Math.min(320, hMin * 0.3);
    const cx = drawer ? w / 2 : handleAt === "right" ? w - 45 : 45;
    const cy = drawer ? hMax * 0.62 : Math.min(hMin / 2, 1050);
    if (config.handle === "knob") {
      detail({ id: `${id}:h`, label: "Tirador", kind: "handle", material: "handle", position: [cx - 14, cy - 14, faceZ + 4], size: [28, 28, 26], geometry: "knob" });
    } else {
      const size: Vec3 = drawer ? [len, 12, 12] : [12, len, 12];
      detail({ id: `${id}:h`, label: "Tirador", kind: "handle", material: "handle", position: [cx - size[0] / 2, cy - size[1] / 2, faceZ + 16], size, geometry: "box" });
      // dos patitas que separan la barra del frente
      for (const k of [0, 1]) {
        const off = (k === 0 ? -1 : 1) * (len / 2 - 14);
        detail({
          id: `${id}:hs${k}`,
          label: "Tirador",
          kind: "handle",
          material: "handle",
          position: drawer ? [cx + off - 4, cy - 4, faceZ] : [cx - 4, cy + off - 4, faceZ],
          size: [8, 8, 16],
          geometry: "box",
        });
      }
    }
    ctx.hw.handle.qty += 1;
  }
  return out;
}

function buildRun(ctx: Ctx, r: number): RunAssembly {
  const { config } = ctx;
  const t = catalog.board.thickness;
  const back = catalog.backBoard.thickness;
  const D = config.depth;
  const H = config.height;
  const Z = config.plinth ? PLINTH_HEIGHT : 0;
  const hinged = config.doors === "hinged";
  const sliding = config.doors === "sliding";
  const run = config.runs[r];
  const span = runSpan(config, r, run.width);
  const mods = run.modules;
  const n = mods.length;
  const xs = moduleOffsets(mods);
  const sloped = r === 0 && config.slope.enabled;
  const hAt = (x: number) => (r === 0 ? heightAt(config, x) : H);

  // la puerta batiente va por delante del cuerpo: el cuerpo pierde su espesor
  const bodyD = hinged ? D - t - 2 : D;
  const carcassD = bodyD - back;
  const shelfD = carcassD - (hinged ? HINGED_SETBACK : 0) - (sliding ? SLIDING_RESERVE : 0);
  const corner = r === 0 ? cornerModule(config.shape, n) : null;
  // el tramo lateral tapa la esquina: ahí va un panel ciego en vez de puerta
  const blind = corner === null ? null : config.shape === "l-left" ? { from: 0, to: D } : { from: span - D, to: span };

  const parts: Part[] = [];
  const add = (p: Omit<Part, "run">) => {
    const full: Part = { ...p, run: r };
    parts.push(full);
    return full;
  };
  const P = (s: string) => `r${r}:${s}`;

  // laterales y divisores, pasantes de piso a techo
  const verticalX = [0, ...xs.slice(1).map((x) => x - t), span - t];
  verticalX.forEach((x, i) => {
    const outer = i === 0 || i === n;
    const h = sloped ? hAt(x + t / 2) : H;
    const id = i === 0 ? "sideL" : i === n ? "sideR" : `div${i}`;
    add({
      id: P(id),
      label: outer ? "Lateral" : "Divisor",
      kind: outer ? "side" : "divider",
      material: config.bodyMaterial,
      module: null,
      position: [x, 0, back],
      size: [t, h, carcassD],
      geometry: "box",
      cut: { length: h, width: carcassD, thickness: t, band: { long: 1, short: 0 } },
      explode: [i === 0 ? -220 : i === n ? 220 : ((x + t / 2) / span - 0.5) * 260, 0, 0],
    });
  });

  mods.forEach((mod, m) => {
    const x0 = xs[m];
    const w = mod.width;
    const M = (s: string) => P(`m${m}:${s}`);
    const hL = hAt(x0);
    const hR = hAt(x0 + w);

    if (sloped) {
      const angle = Math.atan2(hR - hL, w);
      const len = w / Math.cos(angle);
      const cy = (hL + hR) / 2 - t / 2;
      add({
        id: M("top"),
        label: "Techo",
        kind: "top",
        material: config.bodyMaterial,
        module: m,
        position: [x0 + w / 2 - len / 2, cy - t / 2, back],
        size: [len, t, carcassD],
        rotationZ: angle,
        geometry: "box",
        cut: { length: len, width: carcassD, thickness: t, band: { long: 1, short: 0 }, note: `corte a ${deg(angle)}° en las puntas` },
        explode: [0, 220, 0],
      });
      ctx.counts.angledCuts += 1;
    } else {
      add({
        id: M("top"),
        label: "Techo",
        kind: "top",
        material: config.bodyMaterial,
        module: m,
        position: [x0, H - t, back],
        size: [w, t, carcassD],
        geometry: "box",
        cut: { length: w, width: carcassD, thickness: t, band: { long: 1, short: 0 } },
        explode: [0, 220, 0],
      });
    }
    add({
      id: M("bottom"),
      label: "Piso",
      kind: "bottom",
      material: config.bodyMaterial,
      module: m,
      position: [x0, Z, back],
      size: [w, t, carcassD],
      geometry: "box",
      cut: { length: w, width: carcassD, thickness: t, band: { long: 1, short: 0 } },
      explode: [0, 0, 0],
    });
    if (Z > 0) {
      add({
        id: M("plinth"),
        label: "Zócalo",
        kind: "plinth",
        material: config.bodyMaterial,
        module: m,
        position: [x0, 0, bodyD - 20 - t],
        size: [w, Z, t],
        geometry: "box",
        cut: { length: w, width: Z, thickness: t, band: { long: 0, short: 0 } },
        explode: [0, 0, 180],
      });
    }

    // el fondo se parte por módulo, de eje a eje de divisor, para que entre en placa
    const bx0 = m === 0 ? 0 : x0 - t / 2;
    const bx1 = m === n - 1 ? span : x0 + w + t / 2;
    const backL = hAt(bx0) - Z;
    const backR = hAt(bx1) - Z;
    add({
      id: M("back"),
      label: "Fondo",
      kind: "back",
      material: "back",
      module: m,
      position: [bx0, Z, 0],
      size: [bx1 - bx0, Math.max(backL, backR), back],
      geometry: sloped ? "trapezoid" : "box",
      trapezoid: sloped ? { left: backL, right: backR } : undefined,
      cut: {
        length: Math.max(backL, backR),
        width: bx1 - bx0,
        thickness: back,
        band: { long: 0, short: 0 },
        note: sloped ? `trapecio, lado bajo ${Math.round(Math.min(backL, backR))} mm` : undefined,
      },
      explode: [0, 0, -280],
    });

    const innerBottom = Z + t;
    const innerTop = sloped ? Math.min(hL, hR) - t - 20 : H - t;
    /** superficies horizontales del módulo: dónde apoya la luz y dónde cuelga la tira */
    const levels: { id: string; y: number }[] = [];

    const shelf = (key: string, y: number, fixed = false) => {
      add({
        id: M(key),
        label: fixed ? "Estante fijo" : "Estante",
        kind: fixed ? "fixed-shelf" : "shelf",
        material: config.bodyMaterial,
        module: m,
        position: [x0 + 1, y, back],
        size: [w - 2, t, shelfD],
        geometry: "box",
        cut: { length: w - 2, width: shelfD, thickness: t, band: { long: 1, short: 0 } },
        explode: [0, 0, 170],
      });
      levels.push({ id: M(key), y });
    };

    const rod = (key: string, shelfY: number) => {
      const len = w - 2;
      add({
        id: M(key),
        label: "Barral",
        kind: "rod",
        material: "metal",
        module: m,
        position: [x0 + 1, shelfY - 60, back + shelfD / 2 - 15],
        size: [len, 15, 30],
        geometry: "box",
        cut: null,
        explode: [0, 0, 130],
      });
      ctx.hw.rod.qty += len / 1000;
      ctx.hw.rodSupport.qty += 2;
    };

    const drawers = (count: number) => {
      // la caja de cajón pierde 12,5 mm por lado para la corredera
      const slide = Math.max(250, Math.floor((shelfD - t - 10) / 50) * 50);
      const boxW = w - 26;
      const boxH = DRAWER_PITCH - 50;
      for (let j = 0; j < count; j++) {
        const y = innerBottom + j * DRAWER_PITCH + 2;
        const open: Vec3 = [0, 0, slide * 0.55];
        const D_ = (s: string) => M(`d${j}:${s}`);
        const front = add({
          id: D_("front"),
          label: "Frente de cajón",
          kind: "drawer-front",
          material: config.doors === "none" ? config.doorMaterial : config.bodyMaterial,
          module: m,
          position: [x0 + 2, y, back + shelfD - t],
          size: [w - 4, DRAWER_PITCH - 4, t],
          geometry: "box",
          cut: { length: w - 4, width: DRAWER_PITCH - 4, thickness: t, band: { long: 2, short: 2 } },
          openShift: open,
          explode: [0, 0, 320],
          front: config.doors === "none",
        });
        if (config.doors === "none") {
          front.details = frontDetails(ctx, D_("front"), w - 4, { left: DRAWER_PITCH - 4, right: DRAWER_PITCH - 4 }, "drawer");
        }
        for (const side of [0, 1]) {
          add({
            id: D_(side === 0 ? "sideL" : "sideR"),
            label: "Lateral de cajón",
            kind: "drawer-side",
            material: config.bodyMaterial,
            module: m,
            position: [side === 0 ? x0 + 13 : x0 + 13 + boxW - t, y + 20, back + shelfD - t - slide],
            size: [t, boxH, slide],
            geometry: "box",
            cut: { length: slide, width: boxH, thickness: t, band: { long: 1, short: 0 } },
            openShift: open,
            explode: [0, 0, 240],
          });
        }
        for (const end of [0, 1]) {
          add({
            id: D_(end === 0 ? "endB" : "endF"),
            label: "Contrafrente de cajón",
            kind: "drawer-end",
            material: config.bodyMaterial,
            module: m,
            position: [x0 + 13 + t, y + 20, end === 0 ? back + shelfD - t - slide : back + shelfD - 2 * t],
            size: [boxW - 2 * t, boxH, t],
            geometry: "box",
            cut: { length: boxW - 2 * t, width: boxH, thickness: t, band: { long: 1, short: 0 } },
            openShift: open,
            explode: [0, 0, 240],
          });
        }
        add({
          id: D_("floor"),
          label: "Fondo de cajón",
          kind: "drawer-bottom",
          material: "back",
          module: m,
          position: [x0 + 13, y + 17, back + shelfD - t - slide],
          size: [boxW, back, slide],
          geometry: "box",
          cut: { length: slide, width: boxW, thickness: back, band: { long: 0, short: 0 } },
          openShift: open,
          explode: [0, 0, 240],
        });
        ctx.hw.slidePair.qty += 1;
      }
      ctx.counts.drawers += count;
      return innerBottom + drawerZone(count);
    };

    const maletero = innerTop - TOP_SHELF_DROP;

    switch (mod.layout) {
      case "shelves": {
        const gap = (innerTop - innerBottom - mod.shelves * t) / (mod.shelves + 1);
        for (let k = 1; k <= mod.shelves; k++) shelf(`s${k}`, innerBottom + k * gap + (k - 1) * t);
        break;
      }
      case "hanging": {
        shelf("mal", maletero);
        rod("rod0", maletero);
        break;
      }
      case "double-hanging": {
        shelf("mal", maletero);
        rod("rod0", maletero);
        const middle = innerBottom + (maletero - innerBottom) / 2;
        shelf("mid", middle);
        rod("rod1", middle);
        break;
      }
      case "drawers-shelves": {
        const top = drawers(mod.drawers);
        shelf("fs", top, true);
        const from = top + t;
        const gap = (innerTop - from - mod.shelves * t) / (mod.shelves + 1);
        for (let k = 1; k <= mod.shelves; k++) shelf(`s${k}`, from + k * gap + (k - 1) * t);
        break;
      }
      case "drawers-hanging": {
        const top = drawers(mod.drawers);
        shelf("fs", top, true);
        shelf("mal", maletero);
        rod("rod0", maletero);
        break;
      }
    }

    // luz: tira bajo cada estante (y bajo el techo) con su resplandor en el fondo
    // y en la superficie de abajo; perfiles verticales en los laterales
    let lit = false;
    if (mod.ledShelves) {
      const tops = [...levels].sort((a, b) => a.y - b.y);
      // el estante fijo de los cajones no lleva tira: alumbraría los frentes por dentro
      const hangers = [
        ...tops.filter((l) => !l.id.endsWith(":fs")).map((l) => ({ id: l.id, under: l.y })),
        ...(sloped ? [] : [{ id: M("top"), under: H - t }]),
      ];
      hangers.forEach((lv) => {
        const below = tops.filter((l) => l.y + t <= lv.under - 1).pop();
        const floorY = below ? below.y + t : innerBottom;
        const gap = lv.under - floorY;
        if (gap < 120) return;
        const len = w - 30;
        const z = lv.id === M("top") ? back + carcassD - 50 : back + shelfD - 30;
        add({
          id: `${lv.id}:led`,
          label: "Tira LED",
          kind: "led",
          material: "led",
          module: m,
          position: [x0 + 15, lv.under - 8, z],
          size: [len, 8, 14],
          geometry: "box",
          cut: null,
          explode: lv.id === M("top") ? [0, 220, 0] : [0, 0, 170],
        });
        const card = Math.min(gap, 520);
        add({
          id: `${lv.id}:gb`,
          label: "Luz",
          kind: "glow",
          material: "glow",
          module: m,
          position: [x0, lv.under - card, back + 0.6],
          size: [w, card, 0],
          geometry: "glow",
          glow: "z",
          cut: null,
          explode: [0, 0, -280],
        });
        if (gap <= 820) {
          add({
            id: `${lv.id}:gp`,
            label: "Luz",
            kind: "glow",
            material: "glow",
            module: m,
            position: [x0, floorY + 0.6, back],
            size: [w, 0, shelfD],
            geometry: "glow",
            glow: "y",
            cut: null,
            explode: [0, 0, 170],
          });
        }
        ctx.ledMeters += len / 1000;
        lit = true;
      });
    }
    if (mod.ledSides) {
      const h = innerTop - innerBottom;
      for (const side of ["L", "R"] as const) {
        const x = side === "L" ? x0 : x0 + w - 10;
        add({
          id: M(`led${side}`),
          label: "Perfil LED",
          kind: "led",
          material: "led",
          module: m,
          position: [x, innerBottom, back + carcassD - 70],
          size: [10, h, 14],
          geometry: "box",
          cut: null,
          explode: [side === "L" ? -40 : 40, 0, 0],
        });
        add({
          id: M(`glow${side}`),
          label: "Luz",
          kind: "glow",
          material: "glow",
          module: m,
          position: [side === "L" ? x0 + 0.6 : x0 + w - 0.6, innerBottom, back],
          size: [0, h, carcassD - 60],
          geometry: "glow",
          glow: side === "L" ? "x+" : "x-",
          cut: null,
          explode: [side === "L" ? -40 : 40, 0, 0],
        });
        ctx.ledMeters += h / 1000;
      }
      lit = true;
    }
    if (lit) ctx.litModules += 1;

    if (hinged) {
      // la puerta tapa el módulo de eje a eje de divisor; los extremos, hasta afuera
      let dx0 = bx0;
      let dx1 = bx1;
      if (blind && m === corner) {
        if (blind.from === 0) dx0 = blind.to + 2;
        else dx1 = blind.from - 2;
      }
      const span_ = dx1 - dx0;
      const leaves = span_ > 650 ? 2 : 1;
      const doorW = span_ / leaves - DOOR_GAP;
      for (let k = 0; k < leaves; k++) {
        const left = dx0 + k * (span_ / leaves) + DOOR_GAP / 2;
        const hl = hAt(left) - Z - DOOR_GAP;
        const hr = hAt(left + doorW) - Z - DOOR_GAP;
        const hinge: "left" | "right" = leaves === 2 ? (k === 0 ? "left" : "right") : m % 2 === 0 ? "left" : "right";
        const id = M(`door${k}`);
        const doorH = Math.max(hl, hr);
        add({
          id,
          label: "Puerta",
          kind: "door",
          material: config.doorStyle === "glass" ? "none" : config.doorMaterial,
          module: m,
          position: [left, Z + DOOR_GAP / 2, bodyD + 2],
          size: [doorW, doorH, t],
          geometry: sloped ? "trapezoid" : config.doorStyle === "glass" ? "none" : "box",
          trapezoid: sloped ? { left: hl, right: hr } : undefined,
          cut:
            config.doorStyle === "glass"
              ? null
              : {
                  length: doorH,
                  width: doorW,
                  thickness: t,
                  band: { long: 2, short: 2 },
                  note: sloped ? `trapecio, lado bajo ${Math.round(Math.min(hl, hr))} mm` : undefined,
                },
          hinge,
          details: frontDetails(ctx, id, doorW, { left: hl, right: hr }, hinge === "left" ? "right" : "left"),
          explode: [0, 0, 400],
          front: true,
        });
        ctx.hw.hinge.qty += hingesFor(doorH);
        ctx.counts.doors += 1;
        if (sloped) ctx.counts.angledCuts += 1;
      }
    }
  });

  if (blind && config.doors !== "none") {
    const h = H - Z - DOOR_GAP;
    // con corredizas el cuerpo llega hasta adelante: el panel queda al ras
    const blindZ = hinged ? bodyD + 2 : D - t;
    add({
      id: P("blind"),
      label: "Panel ciego de esquina",
      kind: "blind",
      material: config.doorMaterial,
      module: corner,
      position: [blind.from + (blind.from === 0 ? 0 : 2), Z + DOOR_GAP / 2, blindZ],
      size: [D - 2, h, t],
      geometry: "box",
      cut: { length: h, width: D - 2, thickness: t, band: { long: 2, short: 2 } },
      explode: [0, 0, 400],
      front: true,
    });
  }

  if (sliding) {
    const from = t + (blind?.from === 0 ? D - t : 0);
    const to = span - t - (blind && blind.from !== 0 ? D - t : 0);
    const cover = to - from;
    const leaves = slidingLeaves(cover);
    const leafW = (cover + (leaves - 1) * SLIDING_OVERLAP) / leaves;
    const leafH = H - Z - 2 * t - 30;
    for (let k = 0; k < leaves; k++) {
      // las hojas alternan entre el riel de adelante y el de atrás
      const frontTrack = k % 2 === 0;
      const z = frontTrack ? bodyD - 25 - t : bodyD - 55 - t;
      const step = leafW - SLIDING_OVERLAP;
      // al abrir, las del riel de adelante pasan por delante de su vecina
      const shift = frontTrack ? (k < leaves - 1 ? step : -step) : 0;
      const id = P(`slide${k}`);
      add({
        id,
        label: "Hoja corrediza",
        kind: "sliding-door",
        material: config.doorStyle === "glass" ? "none" : config.doorMaterial,
        module: null,
        position: [from + k * step, Z + t + 15, z],
        size: [leafW, leafH, t],
        geometry: config.doorStyle === "glass" ? "none" : "box",
        cut: config.doorStyle === "glass" ? null : { length: leafH, width: leafW, thickness: t, band: { long: 2, short: 2 } },
        details: frontDetails(ctx, id, leafW, { left: leafH, right: leafH }, frontTrack ? "right" : "left"),
        openShift: [shift, 0, 0],
        explode: [0, 0, frontTrack ? 460 : 400],
        front: true,
      });
      ctx.counts.doors += 1;
    }
    ctx.hw.slidingKit.qty += leaves;
    ctx.hw.slidingTrack.qty += (2 * cover) / 1000;
  }

  // altillo: un cuerpo arriba, con las mismas divisiones y sus propias puertas
  if (config.topBox.enabled) {
    const ht = config.topBox.height;
    const altBodyD = config.doors === "none" ? bodyD : D - t - 2;
    const altCarcass = altBodyD - back;
    const lift: Vec3 = [0, 380, 0];
    verticalX.forEach((x, i) => {
      const id = i === 0 ? "sideL" : i === n ? "sideR" : `div${i}`;
      add({
        id: P(`alt:${id}`),
        label: i === 0 || i === n ? "Lateral de altillo" : "Divisor de altillo",
        kind: i === 0 || i === n ? "side" : "divider",
        material: config.bodyMaterial,
        module: null,
        position: [x, H, back],
        size: [t, ht, altCarcass],
        geometry: "box",
        cut: { length: ht, width: altCarcass, thickness: t, band: { long: 1, short: 0 } },
        explode: [i === 0 ? -220 : i === n ? 220 : 0, lift[1], 0],
      });
    });
    mods.forEach((mod, m) => {
      const x0 = xs[m];
      const w = mod.width;
      const A = (s: string) => P(`alt:m${m}:${s}`);
      for (const [key, y, label] of [
        ["bottom", H, "Piso de altillo"],
        ["top", H + ht - t, "Techo de altillo"],
      ] as const) {
        add({
          id: A(key),
          label,
          kind: key === "top" ? "top" : "bottom",
          material: config.bodyMaterial,
          module: m,
          position: [x0, y, back],
          size: [w, t, altCarcass],
          geometry: "box",
          cut: { length: w, width: altCarcass, thickness: t, band: { long: 1, short: 0 } },
          explode: [0, lift[1] + (key === "top" ? 140 : 0), 0],
        });
      }
      const bx0 = m === 0 ? 0 : x0 - t / 2;
      const bx1 = m === n - 1 ? span : x0 + w + t / 2;
      add({
        id: A("back"),
        label: "Fondo de altillo",
        kind: "back",
        material: "back",
        module: m,
        position: [bx0, H, 0],
        size: [bx1 - bx0, ht, back],
        geometry: "box",
        cut: { length: bx1 - bx0, width: ht, thickness: back, band: { long: 0, short: 0 } },
        explode: [0, lift[1], -280],
      });
      if (config.doors !== "none") {
        let dx0 = bx0;
        let dx1 = bx1;
        if (blind && m === corner) {
          if (blind.from === 0) dx0 = blind.to + 2;
          else dx1 = blind.from - 2;
        }
        const span_ = dx1 - dx0;
        const leaves = span_ > 650 ? 2 : 1;
        const doorW = span_ / leaves - DOOR_GAP;
        const doorH = ht - DOOR_GAP;
        for (let k = 0; k < leaves; k++) {
          const hinge: "left" | "right" = leaves === 2 ? (k === 0 ? "left" : "right") : m % 2 === 0 ? "left" : "right";
          const id = A(`door${k}`);
          add({
            id,
            label: "Puerta de altillo",
            kind: "door",
            material: config.doorStyle === "glass" ? "none" : config.doorMaterial,
            module: m,
            position: [dx0 + k * (span_ / leaves) + DOOR_GAP / 2, H + DOOR_GAP / 2, altBodyD + 2],
            size: [doorW, doorH, t],
            geometry: config.doorStyle === "glass" ? "none" : "box",
            cut: config.doorStyle === "glass" ? null : { length: doorH, width: doorW, thickness: t, band: { long: 2, short: 2 } },
            hinge,
            details: frontDetails(ctx, id, doorW, { left: doorH, right: doorH }, hinge === "left" ? "right" : "left"),
            explode: [0, lift[1], 400],
            front: true,
          });
          ctx.hw.hinge.qty += hingesFor(doorH);
          ctx.counts.doors += 1;
        }
      }
      ctx.hw.fittings.qty += 1;
    });
    if (blind && config.doors !== "none") {
      add({
        id: P("alt:blind"),
        label: "Panel ciego de altillo",
        kind: "blind",
        material: config.doorMaterial,
        module: corner,
        position: [blind.from + (blind.from === 0 ? 0 : 2), H + DOOR_GAP / 2, altBodyD + 2],
        size: [D - 2, ht - DOOR_GAP, t],
        geometry: "box",
        cut: { length: ht - DOOR_GAP, width: D - 2, thickness: t, band: { long: 2, short: 2 } },
        explode: [0, lift[1], 400],
        front: true,
      });
    }
  }

  // terminales curvos en los extremos libres
  const ends = curvedEnds(config, r);
  for (const side of ["left", "right"] as const) {
    if (!ends[side]) continue;
    const x = side === "left" ? -CURVE_RADIUS : span;
    const hEnd = sloped ? hAt(side === "left" ? 0 : span) : H;
    const bottomY = Z;
    const topY = hEnd - t;
    const count = Math.max(2, Math.round((topY - bottomY) / 380) - 1);
    const ys = [bottomY, ...Array.from({ length: count }, (_, k) => bottomY + ((k + 1) * (topY - bottomY)) / (count + 1)), topY];
    ys.forEach((y, k) => {
      add({
        id: P(`curve${side === "left" ? "L" : "R"}:${k === 0 ? "bottom" : k === ys.length - 1 ? "top" : `s${k}`}`),
        label: "Estante curvo",
        kind: "curved-shelf",
        material: config.bodyMaterial,
        module: null,
        position: [x, y, 0],
        size: [CURVE_RADIUS, t, bodyD],
        geometry: "quarter",
        quarter: side,
        cut: {
          length: bodyD,
          width: CURVE_RADIUS,
          thickness: t,
          band: { long: 0, short: 0 },
          curvedBand: quarterEllipse(CURVE_RADIUS, bodyD),
          note: `corte curvo, ${CURVE_RADIUS / 10} × ${Math.round(bodyD / 10)} cm`,
        },
        explode: [side === "left" ? -280 : 280, 0, 0],
      });
      ctx.counts.curvedCuts += 1;
    });
  }

  ctx.hw.fittings.qty += n;
  ctx.counts.modules += n;

  const transform = runTransform(config, r);
  return { index: r, ...transform, span, parts };
}

/** qué extremos de un tramo llevan terminal curvo, según la forma */
export function curvedEnds(config: WardrobeConfig, r: number): { left: boolean; right: boolean } {
  const { left, right } = config.curved;
  if (config.shape === "straight") return { left, right };
  // en L, la izquierda y la derecha se miran desde el frente del conjunto
  if (config.shape === "l-left") return r === 0 ? { left: false, right } : { left, right: false };
  return r === 0 ? { left, right: false } : { left: false, right };
}

/** dónde queda y cómo gira cada tramo en el mundo */
export function runTransform(config: WardrobeConfig, r: number): { rotationY: number; offset: Vec3 } {
  if (r === 0) return { rotationY: 0, offset: [0, 0, 0] };
  if (config.shape === "l-left") return { rotationY: Math.PI / 2, offset: [0, 0, config.runs[1].width] };
  return { rotationY: -Math.PI / 2, offset: [config.runs[0].width, 0, config.depth] };
}

/** lleva un punto del tramo al mundo */
export function toWorld(run: Pick<RunAssembly, "rotationY" | "offset">, p: Vec3): Vec3 {
  const c = Math.cos(run.rotationY);
  const s = Math.sin(run.rotationY);
  return [p[0] * c + p[2] * s + run.offset[0], p[1] + run.offset[1], -p[0] * s + p[2] * c + run.offset[2]];
}

export function buildAssembly(config: WardrobeConfig): Assembly {
  const line = (key: HardwareKey, label: string, unit: HardwareLine["unit"]): HardwareLine => ({ key, label, qty: 0, unit });
  const ctx: Ctx = {
    config,
    hw: {
      hinge: line("hinge", "Bisagra cazoleta 35 mm", "u"),
      slidePair: line("slidePair", "Corredera telescópica (par)", "u"),
      rod: line("rod", "Barral oval de aluminio", "m"),
      rodSupport: line("rodSupport", "Soporte de barral", "u"),
      slidingKit: line("slidingKit", "Kit de ruedas por hoja corrediza", "u"),
      slidingTrack: line("slidingTrack", "Perfil de aluminio para corrediza", "m"),
      handle: line("handle", "Tirador", "u"),
      fittings: line("fittings", "Tornillería y uniones por módulo", "u"),
      mirror: line("mirror", "Espejo 4 mm", "m²"),
      glass: line("glass", "Vidrio fumé 4 mm", "m²"),
      frameProfile: line("frameProfile", "Perfil de aluminio para puerta", "m"),
      grooving: line("grooving", "Ranurado CNC por puerta", "u"),
      ledStrip: line("ledStrip", config.led.color === "rgb" ? "Tira LED RGB" : "Tira LED blanca", "m"),
      ledProfile: line("ledProfile", "Perfil de aluminio con difusor", "m"),
      powerSupply: line("powerSupply", "Fuente 12 V 60 W", "u"),
      sensor: line("sensor", "Sensor de apertura", "u"),
      rgbController: line("rgbController", "Controlador RGB con control remoto", "u"),
    },
    counts: { modules: 0, doors: 0, drawers: 0, angledCuts: 0, curvedCuts: 0 },
    ledMeters: 0,
    litModules: 0,
  };

  const runs = config.runs.map((_, r) => buildRun(ctx, r));

  if (ctx.ledMeters > 0) {
    ctx.hw.ledStrip.qty = ctx.ledMeters;
    ctx.hw.ledProfile.qty = ctx.ledMeters;
    // fuentes con 20 % de margen sobre el consumo
    ctx.hw.powerSupply.qty = Math.ceil((ctx.ledMeters * catalog.led.wattsPerMeter * 1.2) / 60);
    if (config.led.sensor && config.doors !== "none") ctx.hw.sensor.qty = ctx.litModules;
    if (config.led.color === "rgb") ctx.hw.rgbController.qty = 1;
  }

  // caja de mundo: todas las esquinas de todas las piezas, ya giradas
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const run of runs) {
    for (const p of run.parts) {
      if (p.kind === "glow") continue;
      for (const dx of [0, 1])
        for (const dy of [0, 1])
          for (const dz of [0, 1]) {
            const w = toWorld(run, [p.position[0] + dx * p.size[0], p.position[1] + dy * p.size[1], p.position[2] + dz * p.size[2]]);
            for (let k = 0; k < 3; k++) {
              min[k] = Math.min(min[k], w[k]);
              max[k] = Math.max(max[k], w[k]);
            }
          }
    }
  }

  return {
    runs,
    hardware: Object.values(ctx.hw).filter((h) => h.qty > 0),
    counts: ctx.counts,
    ledMeters: ctx.ledMeters,
    bounds: { min, max },
  };
}

/** todas las piezas de todos los tramos, con sus terminaciones */
export function allParts(assembly: Assembly): Part[] {
  return assembly.runs.flatMap((r) => r.parts.flatMap((p) => [p, ...(p.details ?? []).map((d) => ({ ...d, run: p.run }))]));
}
