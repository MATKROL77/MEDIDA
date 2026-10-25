/**
 * Despiece y precio de una configuración.
 *
 * Todo el costo sale de piezas reales: placas según cómo se acomodan, metros de
 * tapacanto según los cantos que se pegan, herrajes y luces contados uno por
 * uno. El precio al cliente es ese costo más el margen del taller.
 */

import { allParts, buildAssembly, type Assembly, type HardwareKey, type Part } from "./assembly.ts";
import { catalog, materialById, type Catalog } from "./catalog.ts";
import type { WardrobeConfig } from "./model.ts";
import { nest, type NestResult } from "./nesting.ts";

export type CutRow = {
  label: string;
  material: string;
  materialName: string;
  length: number;
  width: number;
  thickness: number;
  qty: number;
  /** "1L" = un lado largo con canto, "2L 2C" = todo el perímetro */
  edges: string;
  note: string;
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

/** agrupa piezas iguales en una sola fila, como las pide la seccionadora */
export function cutList(parts: Part[]): CutRow[] {
  const rows = new Map<string, CutRow>();
  for (const p of parts) {
    if (!p.cut) continue;
    const length = Math.round(p.cut.length);
    const width = Math.round(p.cut.width);
    const note = p.cut.note ?? "";
    const key = [p.label, p.material, length, width, p.cut.thickness, note].join("|");
    const row = rows.get(key);
    if (row) row.qty += 1;
    else
      rows.set(key, {
        label: p.label,
        material: p.material,
        materialName: materialName(p.material),
        length,
        width,
        thickness: p.cut.thickness,
        qty: 1,
        edges: edgesLabel(p.cut.band, p.cut.curvedBand),
        note,
      });
  }
  return [...rows.values()].sort((a, b) => a.material.localeCompare(b.material) || b.length - a.length);
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
