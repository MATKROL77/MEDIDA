/**
 * Lo que acompaña a un mueble para verlo en uso: ropa colgada, pilas de ropa
 * doblada y zapatillas en un placard. No son piezas: se dibujan, pero no
 * entran en el despiece ni en el precio, y se pueden sacar con un botón.
 */

import type { Assembly, Part, RunAssembly } from "./assembly.ts";

const CLOTHES = ["#e9e4da", "#31445c", "#7c8a78", "#b9a58a", "#2c2c2e", "#a5503f", "#d7d2c8", "#566b7d", "#8a6f57", "#c9c3b6"];
const SHOES = ["#f1efea", "#2b2b2d", "#8a5a3c", "#c8c2b5"];

const extra = (id: string, label: string, color: string, run: number, position: Part["position"], size: Part["size"], radius: number): Part => ({
  id,
  label,
  kind: "shelf",
  material: `tint:${color}`,
  run,
  module: null,
  position,
  size,
  geometry: "cushion",
  radius,
  decor: true,
  cut: null,
  explode: [0, 0, 0],
});

function dress(run: RunAssembly): Part[] {
  const out: Part[] = [];
  const solid = run.parts.filter((p) => ["bottom", "shelf", "fixed-shelf", "drawer-front", "top"].includes(p.kind));
  /** hasta dónde hay lugar libre debajo de una altura, dentro del ancho de una pieza */
  const floorUnder = (p: Part, y: number) =>
    Math.max(0, ...solid.filter((s) => s.position[0] < p.position[0] + p.size[0] && s.position[0] + s.size[0] > p.position[0] && s.position[1] + s.size[1] <= y).map((s) => s.position[1] + s.size[1]));
  const ceilingOver = (p: Part, y: number) =>
    Math.min(Infinity, ...run.parts.filter((s) => s !== p && !s.front && s.kind !== "back" && s.position[0] < p.position[0] + p.size[0] && s.position[0] + s.size[0] > p.position[0] && s.position[1] >= y).map((s) => s.position[1]));

  for (const p of run.parts) {
    if (p.kind === "rod") {
      // camisas y sacos colgados del barral
      const drop = Math.min(620, p.position[1] - floorUnder(p, p.position[1]) - 70);
      if (drop < 320) continue;
      const count = Math.min(16, Math.floor((p.size[0] - 60) / 68));
      const zc = p.position[2] + p.size[2] / 2;
      for (let i = 0; i < count; i++) {
        // algunas perchas vacías: un placard lleno parejo no parece de nadie
        if ((i * 7 + p.id.length) % 5 === 0) continue;
        const long = (i * 3 + p.id.length) % 4 === 0 ? 1 : 0.84;
        const h = drop * long;
        out.push(extra(`deco:${p.id}:${i}`, "Ropa colgada", CLOTHES[(i * 3 + p.id.length) % CLOTHES.length], p.run, [p.position[0] + 34 + i * 68, p.position[1] - h - 14, zc - 200], [40, h, 400], 14));
      }
    } else if (p.kind === "shelf" || p.kind === "fixed-shelf") {
      // pilas de ropa doblada
      const top = p.position[1] + p.size[1];
      const room = ceilingOver(p, top) - top;
      if (room < 140 || p.size[0] < 320) continue;
      const piles = Math.min(3, Math.floor(p.size[0] / 300));
      for (let i = 0; i < piles; i++) {
        if ((i + p.id.length) % 3 === 2) continue;
        const layers = Math.min(4, Math.floor((room - 60) / 42));
        for (let k = 0; k < layers; k++) {
          out.push(extra(`deco:${p.id}:${i}:${k}`, "Ropa doblada", CLOTHES[(i * 2 + k + p.id.length) % CLOTHES.length], p.run, [p.position[0] + 40 + i * 300, top + k * 42, p.position[2] + p.size[2] - 330], [240, 40, 290], 12));
        }
      }
    } else if (p.kind === "bottom") {
      // zapatillas en el piso del módulo, si no hay cajones ahí
      const top = p.position[1] + p.size[1];
      if (ceilingOver(p, top) - top < 220 || p.size[0] < 320) continue;
      const pairs = Math.min(3, Math.floor((p.size[0] - 60) / 260));
      for (let i = 0; i < pairs; i++) {
        for (let k = 0; k < 2; k++) {
          out.push(extra(`deco:${p.id}:${i}:${k}`, "Zapatillas", SHOES[(i + p.id.length) % SHOES.length], p.run, [p.position[0] + 50 + i * 260 + k * 108, top, p.position[2] + p.size[2] - 330], [96, 88, 270], 30));
        }
      }
    }
  }
  return out;
}

/** el mismo placard, vestido: con ropa colgada, doblada y zapatillas */
export function dressed(assembly: Assembly): Assembly {
  return { ...assembly, runs: assembly.runs.map((r) => ({ ...r, parts: [...r.parts, ...dress(r)] })) };
}

/** el mueble solo, sin nada de lo que lo acompaña */
export function undressed(assembly: Assembly): Assembly {
  return { ...assembly, room: undefined, runs: assembly.runs.map((r) => ({ ...r, parts: r.parts.filter((p) => !p.decor) })) };
}
