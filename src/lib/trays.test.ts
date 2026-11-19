import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAssembly } from "./assembly.ts";
import { DEFAULT_CONFIG, LIMITS, leafLook, normalize, type Layout, type ModuleConfig, type WardrobeConfig } from "./model.ts";
import { quote } from "./quote.ts";
import { configLines, decodeConfig, encodeConfig, leafLines } from "./share.ts";

const mod = (layout: Layout, extra: Partial<ModuleConfig> = {}): ModuleConfig => ({ layout, width: 800, shelves: 3, drawers: 2, trays: 0, ledShelves: false, ledSides: false, ...extra });
const straight = (modules: ModuleConfig[], extra: Partial<WardrobeConfig> = {}): WardrobeConfig =>
  normalize({ ...DEFAULT_CONFIG, runs: [{ width: modules.reduce((s, m) => s + m.width, 0) + 100, modules }], ...extra });
const partsOf = (config: WardrobeConfig) => buildAssembly(config).runs.flatMap((r) => r.parts);

test("una bandeja extraíble reemplaza a un estante libre, de abajo hacia arriba, y sale como un cajón", () => {
  const sin = straight([mod("shelves", { shelves: 4 }), mod("hanging")]);
  const con = straight([mod("shelves", { shelves: 4, trays: 2 }), mod("hanging")]);
  const a = buildAssembly(con);
  const parts = a.runs.flatMap((r) => r.parts);
  const bases = parts.filter((p) => p.label === "Bandeja extraíble");
  const fronts = parts.filter((p) => p.label === "Frente de bandeja");
  assert.equal(a.counts.trays, 2);
  assert.equal(bases.length, 2);
  assert.equal(fronts.length, 2);
  // cada bandeja ocupa el lugar de un estante: la cantidad de estantes libres baja en la misma medida
  const free = (c: WardrobeConfig) => partsOf(c).filter((p) => p.kind === "shelf" && p.module === 0).length;
  assert.equal(free(sin) - free(con), 2);
  // son las de más abajo
  const shelfYs = parts.filter((p) => p.kind === "shelf" && p.module === 0).map((p) => p.position[1]);
  for (const b of bases) for (const y of shelfYs) assert.ok(b.position[1] < y, "una bandeja quedó por encima de un estante fijo");
  // salen hacia adelante y entran en el despiece
  for (const p of [...bases, ...fronts]) {
    assert.ok(p.openShift && p.openShift[2] > 0, "la bandeja no sale");
    assert.ok(p.cut, "la bandeja no está en el despiece");
    assert.ok(!p.decor);
  }
});

test("las bandejas llevan sus correderas y su armado en el presupuesto", () => {
  const sin = quote(straight([mod("drawers-shelves", { shelves: 3 }), mod("hanging")]));
  const con = quote(straight([mod("drawers-shelves", { shelves: 3, trays: 2 }), mod("hanging")]));
  const pair = (q: ReturnType<typeof quote>) => q.assembly.hardware.find((h) => h.key === "slidePair")?.qty ?? 0;
  assert.equal(pair(con) - pair(sin), 2);
  assert.ok(con.cost > sin.cost);
  assert.match(con.costs.find((c) => c.label === "Armado")!.detail, /2 bandejas/);
  assert.doesNotMatch(sin.costs.find((c) => c.label === "Armado")!.detail, /bandeja/);
});

test("no puede haber más bandejas que estantes libres, ni bandejas donde no van", () => {
  const c = straight([mod("shelves", { shelves: 2, trays: 9 }), mod("hanging", { trays: 3 }), mod("drawers-hanging", { trays: 2 })]);
  const [a, b, d] = c.runs[0].modules;
  assert.equal(a.trays, 2);
  assert.ok(a.trays <= LIMITS.trays.max);
  assert.equal(b.trays, 0);
  assert.equal(d.trays, 0);
  // un diseño guardado antes de que existieran las bandejas sigue abriendo igual
  const viejo = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as WardrobeConfig;
  for (const r of viejo.runs) for (const m of r.modules) delete (m as Partial<ModuleConfig>).trays;
  const abierto = normalize(viejo);
  assert.ok(abierto.runs.every((r) => r.modules.every((m) => m.trays === 0)));
  assert.deepEqual(buildAssembly(abierto).counts, buildAssembly(DEFAULT_CONFIG).counts);
});

test("las bandejas viajan en el enlace y aparecen en el resumen", () => {
  const c = straight([mod("shelves", { shelves: 4, trays: 1 }), mod("hanging")]);
  const back = decodeConfig(encodeConfig(c));
  assert.ok(back);
  assert.equal(back!.runs[0].modules[0].trays, 1);
  const text = configLines(c).join("\n");
  assert.match(text, /3 estantes, 1 bandeja extraíble/);
});

test("cada hoja corrediza puede llevar su frente y su color, y solo con corredizas", () => {
  const base = straight([mod("hanging"), mod("shelves"), mod("hanging")], { doors: "sliding", doorStyle: "flat", doorMaterial: "blanco" });
  const c = normalize({ ...base, leaves: [null, { style: "mirror" }, { material: "nogal" }] });
  assert.deepEqual(leafLook(c, 0), { style: "flat", material: "blanco" });
  assert.equal(leafLook(c, 1).style, "mirror");
  assert.equal(leafLook(c, 2).material, "nogal");
  const leaves = partsOf(c).filter((p) => p.kind === "sliding-door").sort((p, q) => p.position[0] - q.position[0]);
  assert.equal(leaves.length, 3);
  assert.equal(leaves[2].material, "nogal");
  assert.equal(leaves[0].material, "blanco");
  assert.equal(leafLines(c).length, 2);
  // lo que repite al resto no es una excepción
  assert.equal(normalize({ ...base, leaves: [{ style: "flat" }, { material: "blanco" }, null] }).leaves, undefined);
  // con batientes no hay hojas que combinar
  assert.equal(normalize({ ...c, doors: "hinged" }).leaves, undefined);
  // y un valor inventado se descarta
  const raro = normalize({ ...base, leaves: [{ style: "toString" as never, material: "__proto__" }, null, null] });
  assert.equal(raro.leaves, undefined);
  // viaja en el enlace
  assert.deepEqual(decodeConfig(encodeConfig(c))!.leaves, c.leaves);
});
