import assert from "node:assert/strict";
import { test } from "node:test";

import { catalog } from "./catalog.ts";
import { FAMILIES } from "./families.ts";
import { SPECS, buildFurniture, defaultFurniture, furniturePrice, furnitureSummary, normalizeFurniture, type FurnitureConfig } from "./furniture.ts";

/** todas las combinaciones de extremos de una familia: mínimos, máximos y cada opción */
function variants(family: string): FurnitureConfig[] {
  const spec = SPECS.find((s) => s.id === family)!;
  const base = defaultFurniture(family);
  const out = [base];
  for (const edge of ["min", "max"] as const) {
    const values = { ...base.values };
    for (const c of spec.controls) if (c.type === "size" || c.type === "count") values[c.key] = c[edge];
    out.push(normalizeFurniture({ ...base, values }));
  }
  for (const c of spec.controls) {
    if (c.type === "choice") for (const o of c.options) out.push(normalizeFurniture({ ...base, values: { ...base.values, [c.key]: o.id } }));
    if (c.type === "toggle") out.push(normalizeFurniture({ ...base, values: { ...base.values, [c.key]: !base.values[c.key] } }));
  }
  return out;
}

test("cada familia del sitio que no es el placard tiene su motor", () => {
  for (const f of FAMILIES.filter((f) => f.id !== "placares")) {
    assert.equal(f.status, "demo");
    assert.equal(f.href, `/demo/${f.id}/`);
    assert.ok(SPECS.some((s) => s.id === f.id), `falta el motor de ${f.id}`);
  }
});

test("todo mueble se arma con piezas de medidas reales, sin superponer identificadores", () => {
  for (const spec of SPECS) {
    for (const config of variants(spec.id)) {
      const { parts, assembly } = buildFurniture(config);
      assert.ok(parts.length >= 4, `${spec.id}: muy pocas piezas`);
      assert.equal(new Set(parts.map((p) => p.id)).size, parts.length, `${spec.id}: identificadores repetidos`);
      for (const p of parts) {
        for (const n of [...p.position, ...p.size]) assert.ok(Number.isFinite(n), `${spec.id} ${p.id}: medida no finita`);
        assert.ok(p.size.every((s) => s > 0), `${spec.id} ${p.id}: pieza sin espesor ${p.size}`);
        assert.ok(p.position[1] >= -0.5, `${spec.id} ${p.id}: queda bajo el piso`);
      }
      const { min, max } = assembly.bounds;
      assert.ok(max[0] - min[0] > 200 && max[1] > 200 && max[2] - min[2] > 150, `${spec.id}: mueble sin tamaño`);
    }
  }
});

test("toda pieza de placa entra en una placa entera", () => {
  for (const spec of SPECS) {
    for (const config of variants(spec.id)) {
      for (const p of buildFurniture(config).parts) {
        if (!p.cut) continue;
        const usable = catalog.board.length - 2 * catalog.board.trim;
        assert.ok(p.cut.length <= usable && p.cut.width <= catalog.board.width - 2 * catalog.board.trim, `${spec.id} ${p.id}: ${p.cut.length} × ${p.cut.width} no entra en la placa`);
      }
    }
  }
});

test("las medidas que se piden son las del mueble armado", () => {
  const mesa = buildFurniture(normalizeFurniture({ family: "mesas", values: { width: 2000, depth: 900, height: 760 } })).assembly.bounds;
  assert.deepEqual([mesa.max[0] - mesa.min[0], mesa.max[1], mesa.max[2] - mesa.min[2]], [2000, 760, 900]);
  const biblio = buildFurniture(normalizeFurniture({ family: "bibliotecas", values: { width: 2400, height: 2200, depth: 320 } })).assembly.bounds;
  assert.deepEqual([biblio.max[0] - biblio.min[0], biblio.max[1]], [2400, 2200]);
  const sillon = normalizeFurniture({ family: "sillones", values: { seats: 3, seatWidth: 900, arms: true, chaise: "no" } });
  assert.equal(furnitureSummary(sillon).dimensions.split(" × ")[0], "306", "tres cuerpos de 90 más dos apoyabrazos de 18");
});

test("agrandar o sumar cosas nunca abarata, y el precio es un número redondo", () => {
  for (const spec of SPECS) {
    const [base, small, big] = variants(spec.id);
    const prices = [small, base, big].map((c) => furniturePrice(c));
    assert.ok(prices[0] <= prices[1] && prices[1] <= prices[2], `${spec.id}: ${prices}`);
    assert.ok(prices.every((p) => p > 0 && p % 1000 === 0));
  }
  const sin = furniturePrice(normalizeFurniture({ family: "mesas", values: { drawers: false } }));
  const con = furniturePrice(normalizeFurniture({ family: "mesas", values: { drawers: true } }));
  assert.ok(con > sin, "la cajonera suma");
});

test("un enlace editado a mano no rompe nada", () => {
  for (const bad of [null, "x", { family: "cocinas" }, { family: "tv", values: { width: "1e999", height: -5, fronts: "toString", floating: "sí" }, body: "__proto__", fabric: 7 }]) {
    const c = normalizeFurniture(bad);
    const price = furniturePrice(c);
    assert.ok(Number.isFinite(price) && price > 0);
    assert.ok(furnitureSummary(c).dimensions.endsWith("cm"));
  }
  const tv = normalizeFurniture({ family: "tv", values: { width: 99999, fronts: "toString" } });
  assert.equal(tv.values.width, 2500);
  assert.equal(tv.values.fronts, "mixto");
});

test("cajones y puertas se cuentan como lo que se ve", () => {
  const tv = buildFurniture(normalizeFurniture({ family: "tv", values: { width: 1800, fronts: "puertas" } }));
  assert.equal(tv.doors, 3);
  assert.equal(tv.parts.filter((p) => p.kind === "door").length, 3);
  const luz = buildFurniture(normalizeFurniture({ family: "ratonas", values: { kind: "luz", height: 600, drawers: 2 } }));
  assert.equal(luz.drawers, 2);
  assert.ok(luz.parts.filter((p) => p.kind === "drawer-front").every((p) => p.openShift && p.openShift[2] > 0), "los cajones salen hacia adelante");
});
