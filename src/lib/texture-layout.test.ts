import assert from "node:assert/strict";
import { test } from "node:test";

import { leafLayout, pingPong, plankLayout, seeded, streaks } from "./texture-layout.ts";

test("la misma semilla arma siempre la misma textura", () => {
  const a = seeded(7);
  const b = seeded(7);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  assert.deepEqual(leafLayout(2048, 1024, { seed: 3, min: 110, max: 250, tone: 0.03 }), leafLayout(2048, 1024, { seed: 3, min: 110, max: 250, tone: 0.03 }));
  assert.deepEqual(plankLayout(8, { seed: 5, tone: 0.03 }), plankLayout(8, { seed: 5, tone: 0.03 }));
});

test("la foto se recorre de ida y vuelta, sin saltos", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => pingPong(i, 4)), [0, 1, 2, 3, 3, 2, 1, 0, 0]);
  assert.equal(pingPong(-1, 4), 0);
  // nunca se sale de la foto y entre un píxel y el siguiente no hay más de un paso
  for (let i = -50; i < 50; i++) {
    const v = pingPong(i, 7);
    assert.ok(v >= 0 && v < 7);
    assert.ok(Math.abs(pingPong(i + 1, 7) - v) <= 1);
  }
});

test("las hojas de chapa cubren la placa entera, sin huecos ni encimes", () => {
  for (const seed of [1, 2, 3, 40, 99]) {
    const leaves = leafLayout(2048, 1024, { seed, min: 110, max: 250, tone: 0.04 });
    assert.equal(leaves[0].from, 0);
    assert.equal(leaves[leaves.length - 1].to, 2048);
    leaves.forEach((leaf, i) => {
      if (i) assert.equal(leaf.from, leaves[i - 1].to);
      const w = leaf.to - leaf.from;
      // ninguna hoja queda como una astilla ni como media placa
      assert.ok(w >= 110 && w < 250 + 110, `hoja de ${w} px`);
      assert.ok(leaf.across >= 0 && leaf.across < 1024);
      assert.ok(Math.abs(leaf.gain - 1) <= 0.04 + 1e-9);
    });
    // en 2 m entran varias hojas: ninguna puerta queda de una sola
    assert.ok(leaves.length >= 6);
  }
});

test("el veteado empalma en los bordes y no se pasa de su fuerza", () => {
  const s = streaks(512, { seed: 9, strength: 0.06 });
  let min = 1;
  let max = 1;
  for (const v of s) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  assert.ok(max <= 1.06 + 1e-6 && min >= 0.94 - 1e-6);
  assert.ok(max - min > 0.05, "el veteado no puede quedar chato");
  // de la última columna a la primera hay el mismo salto que entre dos vecinas cualesquiera
  let step = 0;
  for (let x = 1; x < s.length; x++) step = Math.max(step, Math.abs(s[x] - s[x - 1]));
  assert.ok(Math.abs(s[0] - s[s.length - 1]) <= step + 1e-6);
});

test("el piso usa cada tabla cuatro veces, cada vez dada vuelta de otra manera", () => {
  for (const rows of [8, 9]) {
    for (const seed of [1, 5, 23]) {
      const floor = plankLayout(rows, { seed, tone: 0.03 });
      assert.equal(floor.length, rows * 2);
      const seen = new Map<number, Set<string>>();
      for (const row of floor)
        for (const p of row.planks) {
          const ways = seen.get(p.source) ?? new Set<string>();
          ways.add(`${p.flipLength}-${p.flipWidth}`);
          seen.set(p.source, ways);
          assert.ok(Math.abs(p.gain - 1) <= 0.03 + 1e-9);
        }
      assert.equal(seen.size, rows);
      for (const ways of seen.values()) assert.equal(ways.size, 4);
    }
  }
});

test("dos hileras vecinas no repiten tabla y sus juntas quedan trabadas", () => {
  const far = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
  for (const rows of [8, 9]) {
    for (const seed of [1, 5, 23, 77]) {
      const floor = plankLayout(rows, { seed, tone: 0.03 });
      floor.forEach((row, r) => {
        const next = floor[(r + 1) % floor.length];
        const mine = row.planks.map((p) => p.source);
        assert.notEqual(mine[0], mine[1]);
        for (const p of next.planks) assert.ok(!mine.includes(p.source), `la hilera ${r} repite tabla con la siguiente`);
        assert.ok(far(row.joint, next.joint) >= 0.19, `juntas alineadas en la hilera ${r}`);
      });
    }
  }
});
