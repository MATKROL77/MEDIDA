/**
 * Arma el placard pieza por pieza.
 *
 * De acá salen a la vez el modelo 3D y el despiece: cada pieza trae su caja en
 * el espacio (para dibujarla) y su medida de corte (para la seccionadora). Por
 * eso lo que el cliente ve es exactamente lo que el taller corta.
 *
 * Sistema de coordenadas en mm: x hacia la derecha, y hacia arriba, z hacia el
 * frente. El fondo del placard está en z = 0.
 *
 * Construcción: laterales y divisores pasantes de piso a techo, techo y piso
 * por módulo entre ellos. Así ninguna pieza horizontal supera el ancho de un
 * módulo y todo entra en una placa estándar, aunque el placard mida 4 metros.
 */

import { catalog } from "./catalog.ts";
import {
  DRAWER_PITCH,
  PLINTH_HEIGHT,
  TOP_SHELF_DROP,
  drawerZone,
  innerModuleWidth,
  type WardrobeConfig,
} from "./model.ts";

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
  | "sliding-door";

export type Cut = {
  /** largo en el sentido de la veta */
  length: number;
  width: number;
  thickness: number;
  /** cuántos lados largos y cortos llevan tapacanto */
  band: { long: 0 | 1 | 2; short: 0 | 1 | 2 };
};

export type Part = {
  id: string;
  label: string;
  kind: PartKind;
  /** id de material del catálogo, "back" para el MDF del fondo, "metal" para herrajes */
  material: string;
  module: number | null;
  /** caja en el espacio: esquina mínima y tamaño, en mm */
  position: [number, number, number];
  size: [number, number, number];
  /** null para lo que no sale de placa (el barral) */
  cut: Cut | null;
  /** las puertas batientes giran sobre este borde al abrir */
  hinge?: "left" | "right";
};

export type HardwareKey =
  | "hinge"
  | "slidePair"
  | "rod"
  | "rodSupport"
  | "slidingKit"
  | "slidingTrack"
  | "handle"
  | "fittings";

export type HardwareLine = {
  key: HardwareKey;
  label: string;
  qty: number;
  unit: "u" | "m";
};

export type Assembly = {
  parts: Part[];
  hardware: HardwareLine[];
  counts: { modules: number; doors: number; drawers: number };
};

/** bisagras por puerta según su alto: lo que recomiendan los fabricantes de herrajes */
export function hingesFor(doorHeight: number): number {
  if (doorHeight <= 900) return 2;
  if (doorHeight <= 1600) return 3;
  if (doorHeight <= 2000) return 4;
  return 5;
}

/** hojas corredizas según el ancho total */
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

export function buildAssembly(config: WardrobeConfig): Assembly {
  const t = catalog.board.thickness;
  const back = catalog.backBoard.thickness;
  const { width: W, height: H, depth: D } = config;
  const Z = config.plinth ? PLINTH_HEIGHT : 0;
  const hinged = config.doors === "hinged";
  const sliding = config.doors === "sliding";

  // la puerta batiente va por delante del cuerpo: el cuerpo pierde su espesor
  const bodyD = hinged ? D - t - 2 : D;
  const carcassD = bodyD - back;
  const shelfD = carcassD - (hinged ? HINGED_SETBACK : 0) - (sliding ? SLIDING_RESERVE : 0);

  const n = config.modules.length;
  const w = innerModuleWidth(W, n);
  const verticalX = (i: number) => i * (w + t);
  const innerBottom = Z + t;
  const innerTop = H - t;

  const parts: Part[] = [];
  const hardware: Record<HardwareKey, HardwareLine> = {
    hinge: { key: "hinge", label: "Bisagra cazoleta 35 mm", qty: 0, unit: "u" },
    slidePair: { key: "slidePair", label: "Corredera telescópica (par)", qty: 0, unit: "u" },
    rod: { key: "rod", label: "Barral oval de aluminio", qty: 0, unit: "m" },
    rodSupport: { key: "rodSupport", label: "Soporte de barral", qty: 0, unit: "u" },
    slidingKit: { key: "slidingKit", label: "Kit de ruedas por hoja corrediza", qty: 0, unit: "u" },
    slidingTrack: { key: "slidingTrack", label: "Perfil de aluminio para corrediza", qty: 0, unit: "m" },
    handle: { key: "handle", label: "Tirador", qty: 0, unit: "u" },
    fittings: { key: "fittings", label: "Tornillería y uniones por módulo", qty: n, unit: "u" },
  };

  let doorCount = 0;
  let drawerCount = 0;
  const add = (p: Omit<Part, "id">) => parts.push({ ...p, id: `${p.kind}-${parts.length}` });

  // laterales y divisores, pasantes de piso a techo
  for (let i = 0; i <= n; i++) {
    const outer = i === 0 || i === n;
    add({
      label: outer ? "Lateral" : "Divisor",
      kind: outer ? "side" : "divider",
      material: config.bodyMaterial,
      module: null,
      position: [verticalX(i), 0, back],
      size: [t, H, carcassD],
      cut: { length: H, width: carcassD, thickness: t, band: { long: 1, short: 0 } },
    });
  }

  config.modules.forEach((mod, m) => {
    const x0 = verticalX(m) + t;

    add({
      label: "Techo",
      kind: "top",
      material: config.bodyMaterial,
      module: m,
      position: [x0, H - t, back],
      size: [w, t, carcassD],
      cut: { length: w, width: carcassD, thickness: t, band: { long: 1, short: 0 } },
    });
    add({
      label: "Piso",
      kind: "bottom",
      material: config.bodyMaterial,
      module: m,
      position: [x0, Z, back],
      size: [w, t, carcassD],
      cut: { length: w, width: carcassD, thickness: t, band: { long: 1, short: 0 } },
    });
    if (Z > 0) {
      add({
        label: "Zócalo",
        kind: "plinth",
        material: config.bodyMaterial,
        module: m,
        position: [x0, 0, bodyD - 20 - t],
        size: [w, Z, t],
        cut: { length: w, width: Z, thickness: t, band: { long: 0, short: 0 } },
      });
    }

    // el fondo se parte por módulo, de eje a eje de divisor, para que entre en placa
    const bx0 = m === 0 ? 0 : verticalX(m) + t / 2;
    const bx1 = m === n - 1 ? W : verticalX(m + 1) + t / 2;
    add({
      label: "Fondo",
      kind: "back",
      material: "back",
      module: m,
      position: [bx0, Z, 0],
      size: [bx1 - bx0, H - Z, back],
      cut: { length: H - Z, width: bx1 - bx0, thickness: back, band: { long: 0, short: 0 } },
    });

    const shelf = (y: number, fixed = false) =>
      add({
        label: fixed ? "Estante fijo" : "Estante",
        kind: fixed ? "fixed-shelf" : "shelf",
        material: config.bodyMaterial,
        module: m,
        position: [x0 + 1, y, back],
        size: [w - 2, t, shelfD],
        cut: { length: w - 2, width: shelfD, thickness: t, band: { long: 1, short: 0 } },
      });

    const rod = (shelfY: number) => {
      const len = w - 2;
      add({
        label: "Barral",
        kind: "rod",
        material: "metal",
        module: m,
        position: [x0 + 1, shelfY - 60, back + shelfD / 2 - 15],
        size: [len, 15, 30],
        cut: null,
      });
      hardware.rod.qty += len / 1000;
      hardware.rodSupport.qty += 2;
    };

    const drawers = (count: number) => {
      // la caja de cajón pierde 12,5 mm por lado para la corredera
      const slide = Math.max(250, Math.floor((shelfD - t - 10) / 50) * 50);
      const boxW = w - 26;
      const boxH = DRAWER_PITCH - 50;
      for (let j = 0; j < count; j++) {
        const y = innerBottom + j * DRAWER_PITCH + 2;
        add({
          label: "Frente de cajón",
          kind: "drawer-front",
          material: config.doors === "none" ? config.doorMaterial : config.bodyMaterial,
          module: m,
          position: [x0 + 2, y, back + shelfD - t],
          size: [w - 4, DRAWER_PITCH - 4, t],
          cut: { length: w - 4, width: DRAWER_PITCH - 4, thickness: t, band: { long: 2, short: 2 } },
        });
        for (const side of [0, 1]) {
          add({
            label: "Lateral de cajón",
            kind: "drawer-side",
            material: config.bodyMaterial,
            module: m,
            position: [side === 0 ? x0 + 13 : x0 + 13 + boxW - t, y + 20, back + shelfD - t - slide],
            size: [t, boxH, slide],
            cut: { length: slide, width: boxH, thickness: t, band: { long: 1, short: 0 } },
          });
        }
        for (const end of [0, 1]) {
          add({
            label: "Contrafrente de cajón",
            kind: "drawer-end",
            material: config.bodyMaterial,
            module: m,
            position: [x0 + 13 + t, y + 20, end === 0 ? back + shelfD - 2 * t - slide + t : back + shelfD - 2 * t],
            size: [boxW - 2 * t, boxH, t],
            cut: { length: boxW - 2 * t, width: boxH, thickness: t, band: { long: 1, short: 0 } },
          });
        }
        add({
          label: "Fondo de cajón",
          kind: "drawer-bottom",
          material: "back",
          module: m,
          position: [x0 + 13, y + 17, back + shelfD - t - slide],
          size: [boxW, back, slide],
          cut: { length: slide, width: boxW, thickness: back, band: { long: 0, short: 0 } },
        });
        hardware.slidePair.qty += 1;
        if (config.doors === "none" && config.handle !== "none") hardware.handle.qty += 1;
      }
      drawerCount += count;
      return innerBottom + drawerZone(count);
    };

    const maletero = innerTop - TOP_SHELF_DROP;

    switch (mod.layout) {
      case "shelves": {
        const gap = (innerTop - innerBottom - mod.shelves * t) / (mod.shelves + 1);
        for (let k = 1; k <= mod.shelves; k++) shelf(innerBottom + k * gap + (k - 1) * t);
        break;
      }
      case "hanging": {
        shelf(maletero);
        rod(maletero);
        break;
      }
      case "double-hanging": {
        shelf(maletero);
        rod(maletero);
        const middle = innerBottom + (maletero - innerBottom) / 2;
        shelf(middle);
        rod(middle);
        break;
      }
      case "drawers-shelves": {
        const top = drawers(mod.drawers);
        shelf(top, true);
        const from = top + t;
        const gap = (innerTop - from - mod.shelves * t) / (mod.shelves + 1);
        for (let k = 1; k <= mod.shelves; k++) shelf(from + k * gap + (k - 1) * t);
        break;
      }
      case "drawers-hanging": {
        const top = drawers(mod.drawers);
        shelf(top, true);
        shelf(maletero);
        rod(maletero);
        break;
      }
    }

    if (hinged) {
      // la puerta tapa el módulo de eje a eje de divisor; los extremos, hasta afuera
      const span = bx1 - bx0;
      const leaves = span > 650 ? 2 : 1;
      const doorW = span / leaves - DOOR_GAP;
      const doorH = H - Z - DOOR_GAP;
      for (let k = 0; k < leaves; k++) {
        const hinge: "left" | "right" = leaves === 2 ? (k === 0 ? "left" : "right") : m % 2 === 0 ? "left" : "right";
        add({
          label: "Puerta",
          kind: "door",
          material: config.doorMaterial,
          module: m,
          position: [bx0 + k * (span / leaves) + DOOR_GAP / 2, Z + DOOR_GAP / 2, bodyD + 2],
          size: [doorW, doorH, t],
          cut: { length: doorH, width: doorW, thickness: t, band: { long: 2, short: 2 } },
          hinge,
        });
        hardware.hinge.qty += hingesFor(doorH);
        if (config.handle !== "none") hardware.handle.qty += 1;
        doorCount += 1;
      }
    }
  });

  if (sliding) {
    const leaves = slidingLeaves(W);
    const span = W - 2 * t;
    const leafW = (span + (leaves - 1) * SLIDING_OVERLAP) / leaves;
    const leafH = H - Z - 2 * t - 30;
    for (let k = 0; k < leaves; k++) {
      // las hojas alternan entre el riel de adelante y el de atrás
      const z = k % 2 === 0 ? bodyD - 25 - t : bodyD - 55 - t;
      add({
        label: "Hoja corrediza",
        kind: "sliding-door",
        material: config.doorMaterial,
        module: null,
        position: [t + k * (leafW - SLIDING_OVERLAP), Z + t + 15, z],
        size: [leafW, leafH, t],
        cut: { length: leafH, width: leafW, thickness: t, band: { long: 2, short: 2 } },
      });
      if (config.handle !== "none") hardware.handle.qty += 1;
      doorCount += 1;
    }
    hardware.slidingKit.qty = leaves;
    hardware.slidingTrack.qty = (2 * span) / 1000;
  }

  return {
    parts,
    hardware: Object.values(hardware).filter((h) => h.qty > 0),
    counts: { modules: n, doors: doorCount, drawers: drawerCount },
  };
}
