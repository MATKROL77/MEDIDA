import assert from "node:assert/strict";
import { test } from "node:test";

import { buildFurniture, defaultFurniture } from "./furniture.ts";

test("el armado: cada pieza llega desde afuera y en orden de taller", async () => {
  const { entranceOf } = await import("./motion.ts");
  const built = buildFurniture(defaultFurniture("bibliotecas"));
  const run = built.assembly.runs[0];
  const min = [Infinity, Infinity, Infinity] as [number, number, number];
  const max = [-Infinity, -Infinity, -Infinity] as [number, number, number];
  for (const p of run.parts) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p.position[i]); max[i] = Math.max(max[i], p.position[i] + p.size[i]); }
  const of = (p: (typeof run.parts)[number]) => entranceOf(p, { min, max });
  const sides = run.parts.filter((p) => p.kind === "side");
  assert.ok(sides.length >= 2);
  const xs = sides.map((p) => of(p).from![0]);
  // un lateral llega de cada costado, desde bien lejos
  assert.ok(Math.min(...xs) < -2000 && Math.max(...xs) > 2000);
  // los frentes llegan desde adelante y después que los laterales
  const door = run.parts.find((p) => p.kind === "door");
  assert.ok(door && of(door).from![2] > 2000 && of(door).order > Math.max(...sides.map((p) => of(p).order)));
  // todo turno queda entre 0 y 1; la decoración no vuela
  for (const p of run.parts) {
    const e = of(p);
    assert.ok(e.order >= 0 && e.order <= 1, p.id);
    if (p.decor) assert.equal(e.from, null);
  }
  // contra una pared de costado, el lateral baja desde arriba en vez de atravesarla
  const left = sides.find((p) => of(p).from![0] < 0)!;
  assert.deepEqual(entranceOf(left, { min, max }, "l-left").from!.slice(0, 1), [0]);
});
