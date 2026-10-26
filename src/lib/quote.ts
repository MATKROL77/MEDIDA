/**
 * Despiece y precio de una configuración.
 *
 * Todo el costo sale de piezas reales: placas según cómo se acomodan, metros de
 * tapacanto según los cantos que se pegan, herrajes y luces contados uno por
 * uno. El precio al cliente es ese costo más el margen del taller.
 */

import { allParts, buildAssembly, type Assembly, type Feature, type HardwareKey, type Part } from "./assembly.ts";
import { catalog, materialById, type Catalog } from "./catalog.ts";
import type { WardrobeConfig } from "./model.ts";
import { nest, type NestResult } from "./nesting.ts";

export type PieceShape =
  | { kind: "rect" }
  | { kind: "trapezoid"; left: number; right: number }
  | { kind: "quarter"; side: "left" | "right" };

/** un grupo de piezas iguales, como se lo pide al taller */
export type CutRow = {
  /** nombre para el taller: "Estante con luz LED", "Puerta con espejo · bisagras a la izquierda" */
  title: string;
  /** el mismo nombre sin el lado de las bisagras, para los resúmenes */
  baseTitle: string;
  label: string;
  material: string;
  materialName: string;
  length: number;
  width: number;
  thickness: number;
  qty: number;
  band: { long: number; short: number };
  curvedBand?: number;
  /** "1L" = un lado largo con canto, "2L 2C" = todo el perímetro */
  edges: string;
  note: string;
  /** cómo se dibuja: vertical (laterales, puertas, fondos) u horizontal (estantes) */
  orientation: "vertical" | "horizontal";
  shape: PieceShape;
  features: Feature[];
  /** false para lo que no sale de placa: puertas de vidrio y aluminio */
  board: boolean;
};

export type BoardUse = {
  material: string;
  materialName: string;
  thickness: number;
  count: number;
  unitPrice: number;
  nesting: NestResult;
};

export type CostLine = { label: string; detail: string; amount: number };

export type Quote = {
  assembly: Assembly;
  parts: Part[];
  rows: CutRow[];
  boards: BoardUse[];
  bandingMeters: number;
  costs: CostLine[];
  cost: number;
  price: number;
};

const materialName = (id: string) => (id === "back" ? "MDF 3 mm (fondo)" : materialById(id).name);

const edgesLabel = (band: { long: number; short: number }, curved?: number) =>
  [band.long ? `${band.long}L` : "", band.short ? `${band.short}C` : "", curved ? "curvo" : ""].filter(Boolean).join(" ") || "—";

const VERTICAL = new Set(["side", "divider", "back", "door", "sliding-door", "blind"]);

function shapeOf(p: Part): PieceShape {
  if (p.geometry === "trapezoid" && p.trapezoid) return { kind: "trapezoid", left: Math.round(p.trapezoid.left), right: Math.round(p.trapezoid.right) };
  if (p.geometry === "quarter" && p.quarter) return { kind: "quarter", side: p.quarter };
  return { kind: "rect" };
}

/** "Estante" + canal LED = "Estante con luz LED" */
function baseTitleOf(label: string, features: Feature[], glass: boolean): string {
  if (glass) return `${label} de vidrio y aluminio`;
  const parts = [label];
  if (features.some((f) => f.type === "grooves")) parts.push("ranurada");
  if (features.some((f) => f.type === "mirror")) parts.push("con espejo");
  if (features.some((f) => f.type === "led-groove")) parts.push("con luz LED");
  return parts.join(" ");
}

/** las bisagras distinguen puertas izquierdas y derechas: se taladran en espejo */
function titleOf(base: string, features: Feature[]): string {
  const hinge = features.find((f) => f.type === "hinge-holes");
  if (hinge && hinge.type === "hinge-holes") return `${base} · bisagras a la ${hinge.edge === "left" ? "izquierda" : "derecha"}`;
  return base;
}

/** orden de lectura para el taller: estructura, interior, cajones, fondos, frentes, altillo */
function rankOf(label: string): number {
  const altillo = /altillo/i.test(label);
  const front = /^(Puerta|Hoja|Panel)/.test(label);
  if (altillo) return front ? 7 : 5;
  if (/cajón/.test(label)) return 3;
  if (front) return 6;
  if (/^(Lateral|Divisor)/.test(label)) return 0;
  if (/^(Techo|Piso|Zócalo)/.test(label)) return 1;
  if (/^Estante/.test(label)) return 2;
  return 4;
}

/** suma por tipo de pieza, sin separar medidas: "10 × Estante con luz LED" */
export function summaryByTitle(rows: CutRow[]): { title: string; qty: number }[] {
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.baseTitle, (out.get(r.baseTitle) ?? 0) + r.qty);
  return [...out.entries()].map(([title, qty]) => ({ title, qty }));
}

/** agrupa piezas iguales en una sola fila, como las pide la seccionadora */
export function cutList(parts: Part[]): CutRow[] {
  const rows = new Map<string, CutRow>();
  for (const p of parts) {
    const glass = !p.cut && (p.kind === "door" || p.kind === "sliding-door") && p.material === "none";
    if (!p.cut && !glass) continue;
    const length = Math.round(p.cut ? p.cut.length : p.size[1]);
    const width = Math.round(p.cut ? p.cut.width : p.size[0]);
    const thickness = p.cut ? p.cut.thickness : 20;
    const note = p.cut?.note ?? "";
    const features = p.cut?.features ?? [];
    const shape = shapeOf(p);
    const material = glass ? "glass-door" : p.material;
    const key = [p.label, material, length, width, thickness, note, JSON.stringify(features), JSON.stringify(shape)].join("|");
    const row = rows.get(key);
    if (row) {
      row.qty += 1;
      continue;
    }
    const band = p.cut?.band ?? { long: 0, short: 0 };
    const baseTitle = baseTitleOf(p.label, features, glass);
    rows.set(key, {
      title: titleOf(baseTitle, features),
      baseTitle,
      label: p.label,
      material,
      materialName: glass ? "Perfil de aluminio y vidrio fumé" : materialName(p.material),
      length,
      width,
      thickness,
      qty: 1,
      band,
      curvedBand: p.cut?.curvedBand,
      edges: glass ? "—" : edgesLabel(band, p.cut?.curvedBand),
      note,
      orientation: VERTICAL.has(p.kind) ? "vertical" : "horizontal",
      shape,
      features,
      board: !glass,
    });
  }
  return [...rows.values()].sort(
    (a, b) => rankOf(a.label) - rankOf(b.label) || a.baseTitle.localeCompare(b.baseTitle) || b.length - a.length || b.width - a.width,
  );
}

export function bandingMeters(parts: Part[]): number {
  const mm = parts.reduce((sum, p) => {
    if (!p.cut || p.cut.thickness < 10) return sum;
    return sum + p.cut.band.long * p.cut.length + p.cut.band.short * p.cut.width + (p.cut.curvedBand ?? 0);
  }, 0);
  return mm / 1000;
}

export function quote(config: WardrobeConfig, cat: Catalog = catalog): Quote {
  const assembly = buildAssembly(config);
  const { hardware, counts } = assembly;
  const parts = allParts(assembly);
  const rows = cutList(parts);

  // una corrida de acomodo por material, porque cada uno es una placa distinta
  const byMaterial = new Map<string, Part[]>();
  for (const p of parts) {
    if (!p.cut) continue;
    byMaterial.set(p.material, [...(byMaterial.get(p.material) ?? []), p]);
  }

  const boards: BoardUse[] = [...byMaterial.entries()].map(([id, list]) => {
    const isBack = id === "back";
    const spec = isBack
      ? { length: cat.backBoard.length, width: cat.backBoard.width, trim: cat.board.trim, kerf: cat.board.kerf }
      : cat.board;
    const grain = !isBack && materialById(id).grain;
    const nesting = nest(
      list.map((p) => ({ id: p.id, label: p.label, length: p.cut!.length, width: p.cut!.width })),
      spec,
      !grain,
    );
    return {
      material: id,
      materialName: materialName(id),
      thickness: isBack ? cat.backBoard.thickness : cat.board.thickness,
      count: nesting.boards.length,
      unitPrice: isBack ? cat.backBoard.price : materialById(id).boardPrice,
      nesting,
    };
  });

  const banding = bandingMeters(parts);
  const hw = cat.hardware;
  const unitPrice: Record<HardwareKey, number> = {
    hinge: hw.hinge,
    slidePair: hw.slidePair,
    slideSpacer: hw.slideSpacer,
    rod: hw.rodPerMeter,
    rodSupport: hw.rodSupport,
    slidingKit: hw.slidingKitPerLeaf,
    slidingTrack: hw.slidingTrackPerMeter,
    handle: hw.handle[config.handle],
    fittings: hw.fittingsPerModule,
    mirror: cat.fronts.mirrorPerM2,
    glass: cat.fronts.glassPerM2,
    frameProfile: cat.fronts.frameProfilePerMeter,
    grooving: cat.fronts.groovingPerDoor,
    ledStrip: config.led.color === "rgb" ? cat.led.rgbStripPerMeter : cat.led.whiteStripPerMeter,
    ledProfile: cat.led.profilePerMeter,
    powerSupply: cat.led.powerSupply60W,
    sensor: cat.led.sensor,
    rgbController: cat.led.rgbController,
  };
  const qtyLabel = (qty: number, unit: string) => (unit === "u" ? `${qty}` : `${qty.toFixed(2)} ${unit}`);
  const boardCount = boards.reduce((s, b) => s + b.count, 0);

  const costs: CostLine[] = [
    ...boards.map((b) => ({
      label: `Placas ${b.materialName}`,
      detail: `${b.count} × ${money(b.unitPrice)}`,
      amount: b.count * b.unitPrice,
    })),
    {
      label: "Tapacanto",
      // un 10 % más por despuntes y cantos que se rehacen
      detail: `${(banding * 1.1).toFixed(1)} m × ${money(cat.edgeBandPerMeter)}`,
      amount: banding * 1.1 * cat.edgeBandPerMeter,
    },
    ...hardware.map((h) => ({
      label: h.label,
      detail: `${qtyLabel(h.qty, h.unit)} × ${money(unitPrice[h.key])}`,
      amount: h.qty * unitPrice[h.key],
    })),
    {
      label: "Corte y canteado",
      detail: `${boardCount} placas × ${money(cat.labor.perBoard)}`,
      amount: boardCount * cat.labor.perBoard,
    },
    {
      label: "Cortes especiales",
      detail: `${counts.angledCuts} en ángulo, ${counts.curvedCuts} curvos`,
      amount: counts.angledCuts * cat.labor.angledCut + counts.curvedCuts * cat.labor.curvedCut,
    },
    {
      label: "Instalación de luces",
      detail: `${assembly.ledMeters.toFixed(1)} m × ${money(cat.led.installPerMeter)}`,
      amount: assembly.ledMeters * cat.led.installPerMeter,
    },
    {
      label: "Armado",
      detail: `${counts.modules} módulos, ${counts.doors} puertas, ${counts.drawers} cajones`,
      amount: counts.modules * cat.labor.perModule + counts.doors * cat.labor.perDoor + counts.drawers * cat.labor.perDrawer,
    },
  ].filter((c) => c.amount > 0);

  const cost = costs.reduce((s, c) => s + c.amount, 0);
  // se redondea a miles: un precio con centavos parece calculado por una máquina
  const price = Math.ceil((cost * (1 + cat.margin)) / 1000) * 1000;

  return { assembly, parts, rows, boards, bandingMeters: banding, costs, cost, price };
}

export function money(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}
