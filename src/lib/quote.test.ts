import { test } from "node:test";
import assert from "node:assert/strict";

import { allParts, buildAssembly, hingesFor, toWorld } from "./assembly.ts";
import { catalog } from "./catalog.ts";
import { DEFAULT_CONFIG, LIMITS, distribute, normalize, validModuleCounts, withModuleWidth, type WardrobeConfig } from "./model.ts";
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

test("en L el tramo lateral no pisa al de frente", () => {
  for (const shape of ["l-left", "l-right"] as const) {
    const config = normalize({ ...DEFAULT_CONFIG, shape, runs: [{ width: 2600, modules: [] }, { width: 1800, modules: [] }] });
    const a = buildAssembly(config);
    const [front, side] = a.runs;
    const sideCarcass = side.parts.filter((p) => p.kind === "side" || p.kind === "divider" || p.kind === "back");
    for (const p of sideCarcass) {
      const corners = [p.position, [p.position[0] + p.size[0], p.position[1], p.position[2] + p.size[2]]] as const;
      for (const c of corners) {
        const w = toWorld(side, [c[0], c[1], c[2]]);
        // el lateral arranca delante del frente: nada suyo detrás de z = profundidad
        assert.ok(w[2] >= config.depth - 0.5, `${shape} ${p.id} entra en el frente (z=${w[2].toFixed(1)})`);
      }
    }
    assert.ok(front.parts.some((p) => p.kind === "blind"), `${shape} sin panel ciego`);
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
  for (const width of [1600, 2400, 3200, 4000]) {
    const config = normalize({
      ...DEFAULT_CONFIG,
      doors: "sliding",
      runs: [{ width, modules: DEFAULT_CONFIG.runs[0].modules.map((m) => ({ ...m, layout: "drawers-shelves", drawers: 2, shelves: 2 })) }],
    });
    const a = buildAssembly(config);
    const leaves = leavesOf(a);
    const groups = drawerGroupsOf(a);
    const check = (off: Record<string, number>) => {
      for (const l of leaves) {
        const x = l.home + (off[l.id] ?? 0);
        assert.ok(x >= l.from - 0.5 && x + l.width <= l.to + 0.5, `hoja ${l.id} fuera del riel`);
        for (const o of leaves) {
          if (o === l || o.track !== l.track) continue;
          const y = o.home + (off[o.id] ?? 0);
          assert.ok(x + l.width <= y + 0.5 || y + o.width <= x + 0.5, `${l.id} pisa a ${o.id} en el mismo riel (${width})`);
        }
      }
    };
    const opened = openOffsets(leaves, groups);
    check(opened);
    assert.ok(groups.some((g) => !isCovered(leaves, opened, g)), `al abrir no queda ningún cajón a la vista (${width})`);
    // tocar las hojas en cualquier orden nunca las pisa ni las saca del riel
    let off: Record<string, number> = {};
    for (const l of [...leaves, ...[...leaves].reverse()]) {
      off = toggleLeaf(leaves, off, l.id);
      check(off);
    }
    // una hoja trabada contra otra de su riel igual se corre: empuja a la vecina
    const front = leaves.filter((l) => l.track === 0).sort((p, q) => p.home - q.home);
    if (front.length >= 2) {
      const [first, second] = front;
      const stuck = toggleLeaf(leaves, {}, second.id);
      const moved = toggleLeaf(leaves, stuck, first.id);
      check(moved);
      assert.ok(Math.abs((moved[first.id] ?? 0) - (stuck[first.id] ?? 0)) >= 60, `la hoja trabada no se movió (${width})`);
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
