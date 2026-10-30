import { test } from "node:test";
import assert from "node:assert/strict";

import { allParts, buildAssembly, hingesFor, slidingOpenings, toWorld, type Part, type RunAssembly } from "./assembly.ts";
import { catalog } from "./catalog.ts";
import { DEFAULT_CONFIG, LIMITS, cornerPair, distribute, normalize, validModuleCounts, withModuleWidth, type WardrobeConfig } from "./model.ts";
import { nest } from "./nesting.ts";
import { quote, summaryByTitle } from "./quote.ts";
import { pieceDrawing } from "./drawings.ts";
import { drawerGroupsOf, isCovered, leavesOf, openOffsets, toggleLeaf } from "./motion.ts";
import { decodeConfig, encodeConfig } from "./share.ts";

const usable = {
  length: catalog.board.length - 2 * catalog.board.trim,
  width: catalog.board.width - 2 * catalog.board.trim,
};

const variants: Partial<WardrobeConfig>[] = [
  {},
  { doors: "sliding" },
  { doors: "none" },
  { shape: "l-left", runs: [{ width: 2600, modules: [] }, { width: 1800, modules: [] }] },
  { shape: "l-right", doors: "sliding", runs: [{ width: 3000, modules: [] }, { width: 2000, modules: [] }] },
  { topBox: { enabled: true, height: 500 } },
  { slope: { enabled: true, low: 1500, side: "left" }, doorStyle: "mirror" },
  { curved: { left: true, right: true }, doorStyle: "glass" },
  { doorStyle: "grooved", handle: "knob" },
];
const configs = variants.map((v) => normalize({ ...DEFAULT_CONFIG, ...v }));

test("un link con anchos desbordados mantiene medidas y piezas finitas", () => {
  for (const value of ["1e999", "1e308"]) {
    const raw = JSON.parse(`{"runs":[{"width":2400,"modules":[{"width":${value}},{"width":${value}},{"width":780}]}]}`);
    const config = normalize(raw);
    for (const mod of config.runs[0].modules) {
      assert.ok(Number.isFinite(mod.width));
      assert.ok(mod.width >= LIMITS.moduleInner.min && mod.width <= LIMITS.moduleInner.max);
    }
    const q = quote(config);
    assert.ok(Number.isFinite(q.price) && q.price > 0);
    assert.ok(q.rows.every((row) => Number.isFinite(row.length) && Number.isFinite(row.width)));
  }
});

test("los links no aceptan propiedades heredadas como tipos de interior o frente", () => {
  const raw = JSON.parse('{"doorStyle":"toString","modules":[{"layout":"constructor"},{"layout":"toString"},{"layout":"__proto__"}]}');
  const config = normalize(raw);
  assert.equal(config.doorStyle, DEFAULT_CONFIG.doorStyle);
  assert.ok(config.runs[0].modules.every((mod) => mod.layout === "shelves"));
  assert.ok(Number.isFinite(quote(config).price));
});

test("toda pieza de placa entra en una placa entera", () => {
  for (const config of configs) {
    for (const p of allParts(buildAssembly(config))) {
      if (!p.cut) continue;
      const fits =
        (p.cut.length <= usable.length && p.cut.width <= usable.width) ||
        (p.cut.width <= usable.length && p.cut.length <= usable.width);
      assert.ok(fits, `${p.id} ${p.cut.length}×${p.cut.width} no entra (${config.shape})`);
    }
  }
});

test("los ids de pieza no se repiten", () => {
  for (const config of configs) {
    const ids = allParts(buildAssembly(config)).map((p) => `${p.run}|${p.id}`);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test("las piezas del tramo recto no se salen del placard", () => {
  const config = configs[0];
  const a = buildAssembly(config);
  for (const p of a.runs[0].parts) {
    if (p.kind === "glow") continue;
    const [x, y, z] = p.position;
    const [sx, sy, sz] = p.size;
    assert.ok(x >= -0.01 && x + sx <= config.runs[0].width + 0.01, `${p.id} se sale en x`);
    assert.ok(y >= -0.01 && y + sy <= config.height + 0.01, `${p.id} se sale en y`);
    assert.ok(z >= -0.01 && z + sz <= config.depth + 0.01, `${p.id} se sale en z`);
  }
});

test("en L la esquina es un solo espacio y ningún tramo atraviesa al otro", () => {
  const box = (run: RunAssembly, p: Part) => {
    const a = toWorld(run, p.position);
    const b = toWorld(run, [p.position[0] + p.size[0], p.position[1] + p.size[1], p.position[2] + p.size[2]]);
    return [0, 1, 2].map((i) => [Math.min(a[i], b[i]), Math.max(a[i], b[i])] as const);
  };
  for (const shape of ["l-left", "l-right"] as const) {
    for (const doors of ["hinged", "sliding", "none"] as const) {
      for (const topBox of [false, true]) {
        const config = normalize({
          ...DEFAULT_CONFIG,
          shape,
          doors,
          topBox: { enabled: topBox, height: 450 },
          runs: [{ width: 2600, modules: [] }, { width: 1800, modules: [] }],
        });
        const tag = `${shape} ${doors}${topBox ? " con altillo" : ""}`;
        const a = buildAssembly(config);
        const [front, side] = a.runs;
        assert.ok(!front.parts.some((p) => p.kind === "blind"), `${tag}: quedó un panel ciego`);
        const solid = (p: Part) => !["glow", "led", "rod"].includes(p.kind) && p.geometry !== "none";
        for (const p of side.parts.filter(solid)) {
          const pb = box(side, p);
          for (const q of front.parts.filter(solid)) {
            const qb = box(front, q);
            const overlap = pb.every(([lo, hi], i) => Math.min(hi, qb[i][1]) - Math.max(lo, qb[i][0]) > 0.5);
            assert.ok(!overlap, `${tag}: ${p.id} atraviesa ${q.id}`);
          }
        }
        // los estantes del lateral en la esquina tocan a los del frente
        const pair = cornerPair(config)!;
        const frontShelves = front.parts.filter((p) => p.kind === "shelf" && p.module === pair.front);
        const cornerShelves = side.parts.filter((p) => p.label === "Estante de esquina");
        assert.equal(cornerShelves.length, frontShelves.length, `${tag}: la esquina no tiene los mismos estantes de los dos lados`);
        for (const sh of cornerShelves) {
          const sb = box(side, sh);
          const match = frontShelves.find((f) => Math.abs(f.position[1] - sh.position[1]) < 0.5);
          assert.ok(match, `${tag}: el estante de esquina ${sh.id} no tiene pareja en el frente`);
          const fb = box(front, match!);
          assert.ok(Math.abs(sb[2][0] - fb[2][1]) < 1.5, `${tag}: entre los estantes de la esquina quedan ${(sb[2][0] - fb[2][1]).toFixed(1)} mm`);
        }
        // y en la esquina no hay cajones
        assert.ok(
          !a.runs.some((r) => r.parts.some((p) => p.kind === "drawer-front" && p.module === (r.index === 0 ? pair.front : pair.side))),
          `${tag}: hay cajones en la esquina`,
        );
      }
    }
  }
});

test("techo inclinado: el lado bajo es más bajo", () => {
  const config = configs[6];
  const sides = buildAssembly(config).runs[0].parts.filter((p) => p.kind === "side");
  const [left, right] = sides;
  assert.ok(left.size[1] < right.size[1]);
  assert.ok(Math.abs(left.size[1] - config.slope.low) < 60);
});

test("los anchos de módulo respetan el mínimo y el máximo", () => {
  assert.deepEqual(validModuleCounts(DEFAULT_CONFIG, 0, 2400), [3, 4, 5, 6]);
  const config = normalize({ ...DEFAULT_CONFIG, runs: [{ width: 700, modules: DEFAULT_CONFIG.runs[0].modules }] });
  assert.equal(config.runs[0].modules.length, 1);
});

test("ensanchar un módulo achica a los demás sin cambiar el total", () => {
  const before = configs[0];
  const after = withModuleWidth(before, 0, 0, 900);
  const sum = (c: WardrobeConfig) => c.runs[0].modules.reduce((s, m) => s + m.width, 0);
  assert.ok(Math.abs(sum(before) - sum(after)) < 1);
  assert.ok(Math.abs(after.runs[0].modules[0].width - 900) < 1);
  for (const m of after.runs[0].modules) assert.ok(m.width >= LIMITS.moduleInner.min - 0.1 && m.width <= LIMITS.moduleInner.max + 0.1);
});

test("el reparto respeta los límites", () => {
  const out = distribute([1, 1, 1], [350, 350, 350], [1000, 1000, 1000], 2800);
  assert.ok(Math.abs(out.reduce((a, b) => a + b, 0) - 2800) < 1e-6);
  assert.ok(out.every((w) => w <= 1000));
});

test("un link editado a mano no rompe nada", () => {
  const config = normalize({ width: 99999, height: -3, modules: [{ layout: "x" as never, shelves: 40, drawers: -1 }] } as never);
  assert.equal(config.runs[0].width, LIMITS.width.max);
  assert.equal(config.height, LIMITS.height.min);
  assert.ok(config.runs[0].modules.every((m) => m.shelves <= LIMITS.shelves.max));
  assert.equal(decodeConfig("no-es-base64-valido"), null);
});

test("el link ida y vuelta devuelve la misma configuración", () => {
  for (const config of configs) assert.deepEqual(decodeConfig(encodeConfig(config)), normalize(config));
});

test("bisagras según el alto de puerta", () => {
  assert.equal(hingesFor(800), 2);
  assert.equal(hingesFor(1500), 3);
  assert.equal(hingesFor(1900), 4);
  assert.equal(hingesFor(2300), 5);
});

test("el acomodo no superpone piezas y respeta la placa", () => {
  const pieces = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, label: "x", length: 300 + i * 40, width: 200 + (i % 5) * 90 }));
  const result = nest(pieces, catalog.board, true);
  assert.equal(result.oversize.length, 0);
  assert.equal(result.boards.flat().length, pieces.length);
  for (const board of result.boards) {
    for (const a of board) {
      assert.ok(a.x + a.w <= usable.length && a.y + a.h <= usable.width);
      for (const b of board) {
        if (a === b) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.ok(!overlap, `${a.id} pisa a ${b.id}`);
      }
    }
  }
});

test("más grande, más caro; las luces y los extras suman", () => {
  const base = normalize({ ...DEFAULT_CONFIG, runs: [{ width: 2400, modules: DEFAULT_CONFIG.runs[0].modules.map((m) => ({ ...m, ledShelves: false })) }] });
  const big = normalize({ ...base, runs: [{ width: 3600, modules: base.runs[0].modules }] });
  const lit = normalize({ ...base, runs: [{ width: 2400, modules: base.runs[0].modules.map((m) => ({ ...m, ledShelves: true, ledSides: true })) }] });
  const top = normalize({ ...base, topBox: { enabled: true, height: 450 } });
  const q = quote(base);
  assert.ok(quote(big).price > q.price);
  assert.ok(quote(lit).price > q.price);
  assert.ok(quote(lit).assembly.ledMeters > 0);
  assert.ok(quote(top).price > q.price);
  assert.ok(q.price > q.cost);
});

test("el resumen para el taller suma estantes con luz y marca los mecanizados", () => {
  const config = normalize({ ...DEFAULT_CONFIG, doors: "hinged" });
  const q = quote(config);
  const lit = q.parts.filter((p) => p.cut?.features?.some((f) => f.type === "led-groove") && (p.kind === "shelf" || p.kind === "fixed-shelf"));
  const summary = summaryByTitle(q.rows);
  const row = summary.find((r) => r.title === "Estante con luz LED");
  assert.ok(row && row.qty === lit.length, "los estantes con canal LED tienen que sumarse en una línea");
  for (const door of q.parts.filter((p) => p.kind === "door")) {
    const hinges = door.cut?.features?.find((f) => f.type === "hinge-holes");
    assert.ok(hinges && hinges.type === "hinge-holes" && hinges.at.length === hingesFor(door.size[1]));
  }
  // cada grupo de piezas se puede dibujar
  for (const r of q.rows) assert.ok(pieceDrawing(r).prims.length > 0);
});

test("corredizas: las hojas de un mismo riel nunca se pisan y el cajón tapado no sale", () => {
  const cases = [1600, 2400, 3010, 3200, 4000].flatMap((width) => (["straight", "l-left", "l-right"] as const).map((shape) => ({ width, shape })));
  for (const { width, shape } of cases) {
    const config = normalize({
      ...DEFAULT_CONFIG,
      shape,
      doors: "sliding",
      runs: [{ width, modules: DEFAULT_CONFIG.runs[0].modules.map((m) => ({ ...m, layout: "drawers-shelves", drawers: 2, shelves: 2 })) }],
    });
    // si no entran dos hojas de verdad, el placard pasa a batientes
    if (config.doors !== "sliding") {
      assert.ok(shape !== "straight" || width < 2 * 480 + 3 * 18, `${shape} ${width} tendría que admitir corredizas`);
      continue;
    }
    const a = buildAssembly(config);
    const leaves = leavesOf(a);
    const groups = drawerGroupsOf(a);
    const check = (off: Record<string, number>) => {
      for (const l of leaves) {
        const x = l.home + (off[l.id] ?? 0);
        assert.ok(x >= l.from - 0.5 && x + l.width <= l.to + 0.5, `hoja ${l.id} fuera del riel`);
        for (const o of leaves) {
          if (o === l || o.run !== l.run || o.track !== l.track) continue;
          const y = o.home + (off[o.id] ?? 0);
          assert.ok(x + l.width <= y + 0.5 || y + o.width <= x + 0.5, `${l.id} pisa a ${o.id} en el mismo riel (${shape} ${width})`);
        }
      }
    };
    const opened = openOffsets(leaves, groups);
    check(opened);
    assert.ok(groups.some((g) => !isCovered(leaves, opened, g)), `al abrir no queda ningún cajón a la vista (${shape} ${width})`);
    // una hoja por módulo, y se juntan sobre los divisores
    for (const run of a.runs) {
      const mine = leaves.filter((l) => l.run === run.index);
      assert.equal(mine.length, config.runs[run.index].modules.length, `hojas y módulos no coinciden (${shape} ${width})`);
      const dividers = run.parts.filter((p) => p.kind === "divider").map((p) => p.position[0] + p.size[0] / 2);
      for (const c of dividers) {
        assert.ok(mine.some((l) => Math.abs(l.home + l.width - (c + 20)) < 0.5), `ninguna hoja termina sobre el divisor ${c} (${shape} ${width})`);
      }
    }
    // con una hoja por módulo, todos los cajones tienen por dónde salir
    assert.ok(groups.every((g) => !g.blocked), `hay cajones que nunca salen (${shape} ${width})`);
    for (const g of groups) {
      const mine = leaves.filter((l) => l.run === g.run);
      const openings = slidingOpenings(mine, mine[0].from, mine[0].to);
      assert.ok(
        openings.some(([a, b]) => g.x0 >= a - 0.5 && g.x1 <= b + 0.5),
        `el cajón ${g.key} no tiene por dónde salir (${shape} ${width})`,
      );
    }
    // tocar las hojas en cualquier orden nunca las pisa ni las saca del riel
    let off: Record<string, number> = {};
    for (const l of [...leaves, ...[...leaves].reverse()]) {
      off = toggleLeaf(leaves, off, l.id);
      check(off);
    }
    // una hoja trabada contra otra de su riel igual se corre: empuja a la vecina
    const front = leaves.filter((l) => l.run === 0 && l.track === 0).sort((p, q) => p.home - q.home);
    if (front.length >= 2) {
      const [first, second] = front;
      const stuck = toggleLeaf(leaves, {}, second.id);
      const moved = toggleLeaf(leaves, stuck, first.id);
      check(moved);
      assert.ok(Math.abs((moved[first.id] ?? 0) - (stuck[first.id] ?? 0)) >= 60, `la hoja trabada no se movió (${shape} ${width})`);
    }
  }
});

test("batientes: dos puertas en el mismo divisor no abren igual y los cajones dejan lugar", () => {
  const config = normalize({ ...DEFAULT_CONFIG, doors: "hinged" });
  const a = buildAssembly(config);
  const doors = a.runs[0].parts.filter((p) => p.kind === "door");
  for (const d of doors) {
    if (d.hinge !== "right") continue;
    const ax = d.position[0] + d.size[0];
    const pair = doors.find((o) => o.hinge === "left" && Math.abs(o.position[0] - ax) < 12);
    if (pair) assert.notEqual(d.openAngle, pair.openAngle, "un par en el mismo divisor tiene que abrir a distinto ángulo");
  }
  // el frente de un cajón interior deja 12 mm por lado para la puerta abierta
  for (const f of a.runs[0].parts.filter((p) => p.kind === "drawer-front")) {
    const bottom = a.runs[0].parts.find((p) => p.kind === "bottom" && p.module === f.module)!;
    assert.ok(f.position[0] - bottom.position[0] >= 11.9);
  }
  // los cajones que se abren tienen todas sus puertas a 90°
  for (const f of a.runs[0].parts.filter((p) => p.kind === "drawer-front" && !p.drawerBlocked)) {
    for (const d of doors.filter((x) => x.module === f.module)) assert.ok(Math.abs((d.openAngle ?? 0) - Math.PI / 2) < 1e-6);
  }
});
