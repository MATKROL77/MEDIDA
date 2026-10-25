import { test } from "node:test";
import assert from "node:assert/strict";

import { buildAssembly, hingesFor } from "./assembly.ts";
import { catalog } from "./catalog.ts";
import { DEFAULT_CONFIG, LIMITS, normalize, validModuleCounts } from "./model.ts";
import { nest } from "./nesting.ts";
import { quote } from "./quote.ts";
import { decodeConfig, encodeConfig } from "./share.ts";

const usable = {
  length: catalog.board.length - 2 * catalog.board.trim,
  width: catalog.board.width - 2 * catalog.board.trim,
};

test("toda pieza de placa entra en una placa entera", () => {
  for (const width of [600, 1200, 2400, 3200, 4000]) {
    for (const doors of ["none", "hinged", "sliding"] as const) {
      const config = normalize({ ...DEFAULT_CONFIG, width, height: LIMITS.height.max, doors });
      for (const p of buildAssembly(config).parts) {
        if (!p.cut) continue;
        const fits =
          (p.cut.length <= usable.length && p.cut.width <= usable.width) ||
          (p.cut.width <= usable.length && p.cut.length <= usable.width);
        assert.ok(fits, `${p.label} ${p.cut.length}×${p.cut.width} no entra (ancho ${width}, ${doors})`);
      }
    }
  }
});

test("las piezas no se salen del placard", () => {
  const config = normalize({ ...DEFAULT_CONFIG, doors: "hinged" });
  for (const p of buildAssembly(config).parts) {
    const [x, y, z] = p.position;
    const [sx, sy, sz] = p.size;
    assert.ok(x >= -0.01 && x + sx <= config.width + 0.01, `${p.label} se sale en x`);
    assert.ok(y >= -0.01 && y + sy <= config.height + 0.01, `${p.label} se sale en y`);
    assert.ok(z >= -0.01 && z + sz <= config.depth + 0.01, `${p.label} se sale en z`);
  }
});

test("los anchos de módulo respetan el mínimo y el máximo", () => {
  assert.deepEqual(validModuleCounts(2400), [3, 4, 5, 6]);
  const config = normalize({ ...DEFAULT_CONFIG, width: 700, modules: DEFAULT_CONFIG.modules });
  assert.equal(config.modules.length, 1);
});

test("un link editado a mano no rompe nada", () => {
  const config = normalize({ width: 99999, height: -3, modules: [{ layout: "x" as never, shelves: 40, drawers: -1 }] });
  assert.equal(config.width, LIMITS.width.max);
  assert.equal(config.height, LIMITS.height.min);
  assert.ok(config.modules.every((m) => m.shelves <= LIMITS.shelves.max));
  assert.equal(decodeConfig("no-es-base64-valido"), null);
});

test("el link ida y vuelta devuelve la misma configuración", () => {
  assert.deepEqual(decodeConfig(encodeConfig(DEFAULT_CONFIG)), normalize(DEFAULT_CONFIG));
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

test("más grande, más caro", () => {
  const small = quote(normalize({ ...DEFAULT_CONFIG, width: 1200 }));
  const big = quote(normalize({ ...DEFAULT_CONFIG, width: 3600 }));
  assert.ok(big.price > small.price);
  assert.ok(small.price > small.cost);
  assert.ok(small.boards.every((b) => b.count >= 1));
});
