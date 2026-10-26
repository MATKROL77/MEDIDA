/**
 * Cómo se mueve lo que se abre: hojas corredizas, cajones y su orden.
 *
 * Las reglas son las de un placard real: una hoja corrediza corre por su
 * riel hasta tocar la otra hoja del mismo riel; un cajón sólo sale si nada lo
 * tapa, y si una hoja va a pasar por delante, primero se cierra el cajón.
 * Todo lo de acá es puro: el 3D lo usa cuadro a cuadro y las pruebas lo
 * verifican sin navegador.
 */

import type { Assembly, Part } from "./assembly.ts";

export type Leaf = {
  id: string;
  run: number;
  /** 0 = riel de adelante, 1 = riel de atrás */
  track: 0 | 1;
  index: number;
  /** borde izquierdo en su lugar de cerrado, en mm del tramo */
  home: number;
  width: number;
  /** recorrido posible del conjunto de hojas */
  from: number;
  to: number;
};

export type Offsets = Record<string, number>;

/** un cajón (o los cajones de un módulo, que salen juntos) y el ancho que ocupa */
export type DrawerGroup = { key: string; run: number; module: number; x0: number; x1: number; blocked: boolean };

/** cuánto se puede pisar un cajón sin que se considere tapado (la luz entre hojas) */
const COVER_TOLERANCE = 20;

export function leavesOf(assembly: Assembly): Leaf[] {
  return assembly.runs.flatMap((r) =>
    r.parts
      .filter((p): p is Part & { slide: NonNullable<Part["slide"]> } => p.kind === "sliding-door" && !!p.slide)
      .map((p) => ({ id: p.id, run: r.index, ...p.slide })),
  );
}

export function drawerGroupsOf(assembly: Assembly): DrawerGroup[] {
  const groups = new Map<string, DrawerGroup>();
  for (const r of assembly.runs) {
    for (const p of r.parts) {
      if (p.kind !== "drawer-front" || p.module === null) continue;
      const key = drawerKey(r.index, p.module);
      const g = groups.get(key);
      const x0 = p.position[0];
      const x1 = p.position[0] + p.size[0];
      if (g) {
        g.x0 = Math.min(g.x0, x0);
        g.x1 = Math.max(g.x1, x1);
        g.blocked ||= !!p.drawerBlocked;
      } else groups.set(key, { key, run: r.index, module: p.module, x0, x1, blocked: !!p.drawerBlocked });
    }
  }
  return [...groups.values()];
}

export const drawerKey = (run: number, module: number) => `${run}:${module}`;

const left = (l: Leaf, offsets: Offsets) => l.home + (offsets[l.id] ?? 0);

/** dónde puede ir el borde izquierdo de una hoja sin chocar con las de su riel */
export function freeRange(leaves: Leaf[], offsets: Offsets, leaf: Leaf): [number, number] {
  const mates = leaves.filter((l) => l.run === leaf.run && l.track === leaf.track && l.id !== leaf.id);
  const before = mates.filter((l) => l.home < leaf.home);
  const after = mates.filter((l) => l.home > leaf.home);
  const min = before.length ? Math.max(...before.map((l) => left(l, offsets) + l.width)) : leaf.from;
  const max = after.length ? Math.min(...after.map((l) => left(l, offsets))) - leaf.width : leaf.to - leaf.width;
  return [min, Math.max(min, max)];
}

/** menos que esto no se nota: la hoja está trabada contra otra de su riel */
const MIN_TRAVEL = 60;

/**
 * Tocar una hoja la corre hasta el otro extremo de lo que tiene libre. Si
 * está trabada entre otras de su riel, la corre igual empujando a las
 * vecinas, que es lo que haría una persona: así siempre deja a la vista lo
 * que tapaba.
 */
export function toggleLeaf(leaves: Leaf[], offsets: Offsets, id: string): Offsets {
  const leaf = leaves.find((l) => l.id === id);
  if (!leaf) return offsets;
  const [min, max] = freeRange(leaves, offsets, leaf);
  const x = left(leaf, offsets);
  if (max - min >= MIN_TRAVEL) {
    const target = Math.abs(x - min) < Math.abs(x - max) ? max : min;
    return { ...offsets, [id]: target - leaf.home };
  }
  return pushLeaf(leaves, offsets, leaf);
}

function pushLeaf(leaves: Leaf[], offsets: Offsets, leaf: Leaf): Offsets {
  const mates = leaves.filter((l) => l.run === leaf.run && l.track === leaf.track).sort((a, b) => a.home - b.home);
  const i = mates.indexOf(leaf);
  const before = mates.slice(0, i);
  const after = mates.slice(i + 1);
  const x = left(leaf, offsets);
  const sum = (ls: Leaf[]) => ls.reduce((s, l) => s + l.width, 0);
  // lo ideal es correrla su ancho entero; el tope es el riel con las vecinas apiladas
  const right = Math.min(x + leaf.width, leaf.to - leaf.width - sum(after));
  const leftmost = Math.max(x - leaf.width, leaf.from + sum(before));
  const goRight = right - x >= x - leftmost;
  const target = goRight ? right : leftmost;
  if (Math.abs(target - x) < MIN_TRAVEL) return offsets;
  const out: Offsets = { ...offsets, [leaf.id]: target - leaf.home };
  if (goRight) {
    let edge = target + leaf.width;
    for (const l of after) {
      const at = Math.max(left(l, offsets), edge);
      out[l.id] = at - l.home;
      edge = at + l.width;
    }
  } else {
    let edge = target;
    for (const l of [...before].reverse()) {
      const at = Math.min(left(l, offsets), edge - l.width);
      out[l.id] = at - l.home;
      edge = at;
    }
  }
  return out;
}

/** largo de [x0, x1] que queda tapado por las hojas de ese tramo */
export function coveredLength(leaves: Leaf[], offsets: Offsets, run: number, x0: number, x1: number): number {
  const spans = leaves
    .filter((l) => l.run === run)
    .map((l) => [Math.max(x0, left(l, offsets)), Math.min(x1, left(l, offsets) + l.width)] as const)
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let end = -Infinity;
  for (const [a, b] of spans) {
    const start = Math.max(a, end);
    if (b > start) total += b - start;
    end = Math.max(end, b);
  }
  return total;
}

export function isCovered(leaves: Leaf[], offsets: Offsets, g: Pick<DrawerGroup, "run" | "x0" | "x1">): boolean {
  return coveredLength(leaves, offsets, g.run, g.x0, g.x1) > COVER_TOLERANCE;
}

/**
 * "Abrir" con corredizas: se prueban los movimientos posibles (correr las
 * hojas de adelante o las de atrás, para un lado o para el otro) y se queda
 * con el que deja más cajones y más frente a la vista.
 */
export function openOffsets(leaves: Leaf[], groups: DrawerGroup[]): Offsets {
  const runs = [...new Set(leaves.map((l) => l.run))];
  let result: Offsets = {};
  for (const run of runs) {
    const mine = leaves.filter((l) => l.run === run);
    const candidates: Offsets[] = [];
    for (const track of [0, 1] as const) {
      for (const dir of ["right", "left"] as const) {
        let off: Offsets = {};
        const moving = mine.filter((l) => l.track === track).sort((a, b) => (dir === "right" ? b.home - a.home : a.home - b.home));
        for (const l of moving) {
          const [min, max] = freeRange(mine, off, l);
          off = { ...off, [l.id]: (dir === "right" ? max : min) - l.home };
        }
        candidates.push(off);
      }
    }
    const score = (off: Offsets) => {
      const drawers = groups.filter((g) => g.run === run && !g.blocked && !isCovered(mine, off, g)).length;
      const from = mine[0]?.from ?? 0;
      const to = mine[0]?.to ?? 0;
      const visible = to - from - coveredLength(mine, off, run, from, to);
      return drawers * 1e6 + visible;
    };
    const best = candidates.reduce((a, b) => (score(b) > score(a) ? b : a), candidates[0] ?? {});
    result = { ...result, ...best };
  }
  return result;
}

/** el tramo que barre una hoja al ir de un lugar a otro */
export function sweep(leaf: Leaf, fromOffset: number, toOffset: number): [number, number] {
  const a = leaf.home + Math.min(fromOffset, toOffset);
  const b = leaf.home + Math.max(fromOffset, toOffset) + leaf.width;
  return [a, b];
}

export function overlaps(a: [number, number], g: Pick<DrawerGroup, "x0" | "x1">): boolean {
  return Math.min(a[1], g.x1) - Math.max(a[0], g.x0) > COVER_TOLERANCE;
}
