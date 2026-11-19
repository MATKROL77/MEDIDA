import assert from "node:assert/strict";
import { test } from "node:test";

import { toWorld, type Part, type RunAssembly } from "./assembly.ts";
import { dressed, undressed, HANGER, HUNG } from "./decor.ts";
import { DEFAULT_CONFIG, normalize, type Layout, type ModuleConfig, type WardrobeConfig } from "./model.ts";
import { quote } from "./quote.ts";

const mod = (layout: Layout, extra: Partial<ModuleConfig> = {}): ModuleConfig => ({ layout, width: 800, shelves: 3, drawers: 2, trays: 0, ledShelves: false, ledSides: false, ...extra });
const straight = (modules: ModuleConfig[], extra: Partial<WardrobeConfig> = {}): WardrobeConfig =>
  normalize({ ...DEFAULT_CONFIG, runs: [{ width: modules.reduce((s, m) => s + m.width, 0) + 100, modules }], ...extra });

/** placares de todo tipo: cada interior, con y sin luces, bajos, playos, con altillo, con pendiente y en L */
const CASES: Record<string, WardrobeConfig> = {
  "el de muestra": DEFAULT_CONFIG,
  "sin puertas": normalize({ ...DEFAULT_CONFIG, doors: "none" }),
  corredizas: normalize({ ...DEFAULT_CONFIG, doors: "sliding" }),
  "cada interior": straight([mod("hanging", { width: 900 }), mod("shelves", { shelves: 5, width: 700 }), mod("drawers-hanging", { drawers: 3 }), mod("double-hanging", { width: 900 }), mod("drawers-shelves", { drawers: 4, shelves: 2 })]),
  "con luces": straight([mod("hanging", { ledShelves: true, ledSides: true }), mod("shelves", { shelves: 6, ledShelves: true }), mod("double-hanging", { ledShelves: true, ledSides: true })]),
  "bajo y playo": straight([mod("hanging", { width: 600 }), mod("shelves", { shelves: 4, width: 500 }), mod("drawers-hanging", { drawers: 2, width: 600 })], { depth: 450, height: 1900 }),
  "alto y hondo": straight([mod("double-hanging", { width: 1000 }), mod("hanging", { width: 1000 }), mod("shelves", { shelves: 2, width: 1000 })], { depth: 650, height: 2500 }),
  angosto: straight([mod("hanging", { width: 350 }), mod("shelves", { width: 350, shelves: 4 })]),
  "con altillo": straight([mod("hanging"), mod("drawers-shelves", { drawers: 3 })], { topBox: { enabled: true, height: 450 } }),
  "techo inclinado": straight([mod("hanging"), mod("shelves", { shelves: 4 }), mod("hanging")], { slope: { enabled: true, low: 1500, side: "right" } }),
  "en L a la izquierda": normalize({
    ...DEFAULT_CONFIG,
    shape: "l-left",
    runs: [
      { width: 2600, modules: [mod("hanging"), mod("drawers-shelves", { drawers: 3 }), mod("double-hanging")] },
      { width: 2000, modules: [mod("shelves", { shelves: 4 }), mod("hanging")] },
    ],
  }),
  "en L a la derecha": normalize({
    ...DEFAULT_CONFIG,
    doors: "none",
    shape: "l-right",
    runs: [
      { width: 2600, modules: [mod("double-hanging"), mod("shelves", { shelves: 3 }), mod("hanging")] },
      { width: 2200, modules: [mod("hanging"), mod("drawers-hanging", { drawers: 2 })] },
    ],
  }),
};

type Box = { min: number[]; max: number[] };
const boxOf = (run: RunAssembly, p: Part): Box => {
  const a = toWorld(run, p.position);
  const b = toWorld(run, [p.position[0] + p.size[0], p.position[1] + p.size[1], p.position[2] + p.size[2]]);
  return { min: a.map((v, i) => Math.min(v, b[i])), max: a.map((v, i) => Math.max(v, b[i])) };
};
const crosses = (a: Box, b: Box, slack = 2) => [0, 1, 2].every((k) => a.min[k] < b.max[k] - slack && a.max[k] > b.min[k] + slack);
/** la altura de la cara de abajo de una pieza girada (el techo inclinado), en un x */
const slopeAt = (p: Part, x: number) => p.position[1] + p.size[1] / 2 + (x - p.position[0] - p.size[0] / 2) * Math.tan(p.rotationZ!) - p.size[1] / 2 / Math.cos(p.rotationZ!);

for (const [name, config] of Object.entries(CASES)) {
  test(`ambientación del placard (${name}): nada atraviesa una pieza, nada flota, todo cuelga de su percha`, () => {
    const bare = quote(config).assembly;
    const full = dressed(bare);
    const all = full.runs.flatMap((run) => run.parts.map((part) => ({ run, part, box: boxOf(run, part) })));
    const decor = all.filter((e) => e.part.decor);
    const real = all.filter((e) => !e.part.decor);
    assert.equal(bare.runs.flatMap((r) => r.parts).filter((p) => p.decor).length, 0, "el despiece no se toca");
    assert.deepEqual(
      undressed(full).runs.map((r) => r.parts.map((p) => p.id)),
      bare.runs.map((r) => r.parts.map((p) => p.id)),
      "sin la ambientación queda el mueble solo",
    );
    assert.ok(decor.length > 0, "no hay nada puesto");
    assert.equal(new Set(decor.map((e) => e.part.id)).size, decor.length, "hay ids repetidos");
    for (const { part } of decor) {
      assert.ok(part.cut === null && part.geometry === "garment" && part.garment, `${part.id}: no es ambientación`);
      assert.ok(part.size.every((s) => s > 0 && Number.isFinite(s)) && part.position.every(Number.isFinite), `${part.id}: medida inválida`);
    }
    // contra las piezas del mueble (de su tramo y del otro, en la esquina de un placard en L)
    const hard = real.filter((e) => e.part.kind !== "glow" && e.part.kind !== "led" && e.part.material !== "none");
    for (const d of decor) {
      for (const s of hard) {
        // el gancho de la percha abraza el barral
        if (d.part.label === "Percha" && s.part.kind === "rod") continue;
        if (s.part.rotationZ) {
          if (s.run !== d.run || s.part.kind !== "top") continue;
          const [xa, xb] = [d.part.position[0], d.part.position[0] + d.part.size[0]];
          if (xb < s.part.position[0] || xa > s.part.position[0] + s.part.size[0]) continue;
          assert.ok(d.part.position[1] + d.part.size[1] <= Math.min(slopeAt(s.part, xa), slopeAt(s.part, xb)) + 2, `${d.part.id} atraviesa el techo inclinado`);
          continue;
        }
        assert.ok(!crosses(d.box, s.box), `${d.part.id} (${d.part.label}) atraviesa ${s.part.id}`);
      }
    }
    // la ropa de un tramo no se mete en la del otro
    for (const a of decor) for (const b of decor) if (a.run.index < b.run.index) assert.ok(!crosses(a.box, b.box), `${a.part.id} se cruza con ${b.part.id}`);
    // lo colgado: cada prenda en su percha, y la percha en un barral
    const rods = real.filter((e) => e.part.kind === "rod");
    for (const h of decor.filter((e) => e.part.label === "Percha")) {
      const rod = rods.find((r) => r.run === h.run && crosses(h.box, r.box, 0));
      assert.ok(rod, `${h.part.id}: la percha no cuelga de un barral`);
      const cy = rod.part.position[1] + rod.part.size[1] / 2;
      assert.ok(Math.abs(h.part.position[1] + h.part.size[1] - (cy + HANGER.hookTop)) < 0.01, `${h.part.id}: el gancho no pasa por arriba del barral`);
      assert.ok(h.part.position[0] > rod.part.position[0] && h.part.position[0] + h.part.size[0] < rod.part.position[0] + rod.part.size[0], `${h.part.id}: la percha queda fuera del barral`);
    }
    for (const g of decor.filter((e) => e.part.label === "Ropa colgada")) {
      const h = decor.find((e) => e.part.id === `${g.part.id}:percha`);
      assert.ok(h, `${g.part.id}: prenda sin percha`);
      for (const k of [0, 2]) assert.ok(Math.abs(g.part.position[k] + g.part.size[k] / 2 - (h.part.position[k] + h.part.size[k] / 2)) < 0.01, `${g.part.id}: descentrada de su percha`);
      const shape = g.part.garment!.shape as keyof typeof HUNG;
      // el cuello queda donde nacen los brazos de la percha
      const neck = h.part.position[1] + h.part.size[1] - HANGER.hookTop - HANGER.neck;
      assert.ok(Math.abs(g.part.position[1] + g.part.size[1] - (neck + 2 + HUNG[shape].rise)) < 0.01, `${g.part.id}: no cuelga de los hombros`);
      // y abajo le queda aire
      const below = hard.filter((s) => s.run === g.run && !s.part.rotationZ && s.box.max[1] <= g.box.min[1] + 2 && [0, 2].every((k) => s.box.min[k] < g.box.max[k] && s.box.max[k] > g.box.min[k]));
      const floor = Math.max(0, ...below.filter((s) => ["bottom", "shelf", "fixed-shelf", "drawer-front"].includes(s.part.kind)).map((s) => s.box.max[1]));
      assert.ok(g.box.min[1] - floor >= 38, `${g.part.id}: arrastra (${Math.round(g.box.min[1] - floor)} mm)`);
    }
    // lo apoyado: sobre un estante o un piso, o sobre otra cosa de la ambientación
    for (const d of decor.filter((e) => e.part.label !== "Percha" && e.part.label !== "Ropa colgada")) {
      const over = (s: { box: Box }) => [0, 2].every((k) => s.box.min[k] < d.box.max[k] && s.box.max[k] > d.box.min[k]);
      const onBoard = real.some((s) => s.run === d.run && ["bottom", "shelf", "fixed-shelf"].includes(s.part.kind) && over(s) && Math.abs(s.box.max[1] - d.box.min[1]) < 0.5);
      const onDecor = decor.some((s) => s !== d && s.run === d.run && over(s) && s.box.max[1] - d.box.min[1] >= -0.5 && s.box.max[1] - d.box.min[1] <= 40 && s.box.min[1] < d.box.min[1]);
      assert.ok(onBoard || onDecor, `${d.part.id} (${d.part.label}) flota`);
    }
    // siempre igual: el mismo placard, la misma ropa
    assert.deepEqual(dressed(bare), full);
  });
}

test("el placard de muestra tiene de todo: ropa colgada y doblada, calzado y cajas", () => {
  const parts = dressed(quote(DEFAULT_CONFIG).assembly).runs.flatMap((r) => r.parts.filter((p) => p.decor));
  for (const label of ["Ropa colgada", "Percha", "Ropa doblada", "Calzado", "Caja"]) assert.ok(parts.some((p) => p.label === label), `falta: ${label}`);
  const hung = parts.filter((p) => p.label === "Ropa colgada");
  assert.ok(new Set(hung.map((p) => p.garment!.shape)).size >= 3, "toda la ropa colgada es igual");
  assert.ok(new Set(hung.map((p) => p.material)).size >= 5, "poca variedad de colores");
  // alguna percha vacía
  assert.ok(parts.filter((p) => p.label === "Percha").length > hung.length, "no hay perchas vacías");
});

test("donde hay altura cuelga algo largo, y donde no, no", () => {
  const tall = dressed(quote(straight([mod("hanging", { width: 1000 })])).assembly).runs[0].parts.filter((p) => p.label === "Ropa colgada");
  assert.ok(tall.some((p) => p.garment!.shape === "coat" || p.garment!.shape === "dress"), "no hay vestidos ni tapados");
  const short = dressed(quote(straight([mod("double-hanging", { width: 1000 })])).assembly).runs[0].parts.filter((p) => p.label === "Ropa colgada");
  assert.ok(short.length > 6 && short.every((p) => p.size[1] < 900), "en doble barral va ropa corta");
});

test("al ensanchar un módulo la ropa que ya estaba no cambia", () => {
  const hung = (width: number) =>
    new Map(
      dressed(quote(straight([mod("double-hanging", { width })])).assembly)
        .runs[0].parts.filter((p) => p.label === "Ropa colgada")
        .map((p) => [p.id, `${p.garment!.shape} ${p.garment!.variant} ${p.material}`]),
    );
  for (const [a, b] of [
    [500, 560],
    [600, 640],
    [680, 760],
  ]) {
    const [narrow, wide] = [hung(a), hung(b)];
    assert.ok(wide.size >= narrow.size, `de ${a} a ${b} mm hay menos ropa`);
    // (la última de cada barral puede cambiar: es la que entra justa)
    const same = [...narrow].filter(([id, look]) => wide.get(id) === look).length;
    assert.ok(same >= narrow.size - 2, `de ${a} a ${b} mm cambiaron ${narrow.size - same} prendas`);
  }
});
