import assert from "node:assert/strict";
import { test } from "node:test";

import type { Part } from "./assembly.ts";
import { DECOR_MODELS } from "./decor-models.ts";
import { SPECS, buildFurniture, defaultFurniture, furniturePrice, normalizeFurniture, type FurnitureConfig } from "./furniture.ts";
import { cutList } from "./quote.ts";
import { bookRow, bookStack, coffeeScene, deskScene, diningScene, bedsideScene, frame, laptop, shelfScene, tvTopScene, type Cell } from "./staging.ts";

/** la caja que ocupa una pieza de verdad, con sus giros (primero sobre el eje del frente, después sobre el vertical) */
function extent(p: Part): { min: number[]; max: number[] } {
  const c = p.position.map((v, i) => v + p.size[i] / 2);
  const [rz, ry] = [p.rotationZ ?? 0, p.rotationY ?? 0];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const [x, y, z] = [(sx * p.size[0]) / 2, (sy * p.size[1]) / 2, (sz * p.size[2]) / 2];
        const [x1, y1] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
        const q = [x1 * Math.cos(ry) + z * Math.sin(ry), y1, -x1 * Math.sin(ry) + z * Math.cos(ry)];
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k], c[k] + q[k]);
          max[k] = Math.max(max[k], c[k] + q[k]);
        }
      }
  return { min, max };
}

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

const CELLS: Cell[] = [
  { x: 40, y: 500, z: 30, w: 536, h: 380, d: 262 },
  { x: 40, y: 500, z: 30, w: 780, h: 290, d: 180 },
  { x: 0, y: 0, z: 20, w: 430, h: 240, d: 380 },
  { x: 100, y: 300, z: 20, w: 620, h: 189, d: 360 },
  { x: 100, y: 300, z: 12, w: 640, h: 164, d: 390 },
  { x: 0, y: 0, z: 40, w: 513, h: 284, d: 172 },
  { x: 0, y: 0, z: 30, w: 300, h: 420, d: 160 },
  { x: 0, y: 0, z: 30, w: 200, h: 120, d: 150 },
];

test("lo que va en un estante entra en su hueco: no atraviesa el estante de arriba, ni los costados, ni el fondo", () => {
  let placed = 0;
  for (const cell of CELLS)
    for (const full of [true, false])
      for (let seed = 0; seed < 40; seed++) {
        const parts = shelfScene("t", cell, seed, full);
        placed += parts.length;
        assert.equal(new Set(parts.map((p) => p.id)).size, parts.length, "ids repetidos en un hueco");
        for (const p of parts) {
          const where = `${p.id} (hueco ${cell.w}×${cell.h}×${cell.d}, semilla ${seed}, ${full ? "libros" : "liviano"})`;
          assert.ok(p.decor && p.cut === null, `${where}: no es ambientación`);
          assert.ok(p.size.every((s) => s > 0 && Number.isFinite(s)), `${where}: sin medida`);
          const e = extent(p);
          assert.ok(e.min[1] >= cell.y - 0.5, `${where}: se clava en el estante`);
          assert.ok(e.max[1] <= cell.y + cell.h - 4, `${where}: toca el estante de arriba (${Math.round(e.max[1] - cell.y)} de ${cell.h})`);
          assert.ok(e.min[0] >= cell.x - 1 && e.max[0] <= cell.x + cell.w + 1, `${where}: se sale por el costado`);
          assert.ok(e.min[2] >= cell.z - 1 && e.max[2] <= cell.z + cell.d + 1, `${where}: se sale del fondo (${Math.round(e.min[2])} a ${Math.round(e.max[2])})`);
        }
      }
  assert.ok(placed > 1500, "los huecos quedan vacíos");
});

test("los huecos vecinos no se arman igual: la composición y el objeto se van turnando", () => {
  const cell = CELLS[0];
  for (const full of [true, false]) {
    const shapes = new Set<string>();
    for (let seed = 0; seed < 16; seed++) shapes.add(shelfScene("t", cell, seed, full).map((p) => `${p.model ?? p.geometry}${p.garment?.shape ?? ""}`).join("+"));
    assert.ok(shapes.size >= 6, `${shapes.size} composiciones distintas en 16 huecos`);
  }
});

test("una hilera de libros: lomos de distinto alto y espesor, sin encimarse, y el recostado toca al vecino sin pasarlo", () => {
  for (let seed = 0; seed < 30; seed++) {
    for (const lean of ["end", "start", null] as const) {
      const { parts, end } = bookRow("r", 100, 0, 30, 250, 320, 330, seed, lean);
      assert.ok(parts.length >= 4, "muy pocos libros");
      const upright = parts.filter((p) => !p.rotationZ).sort((a, b) => a.position[0] - b.position[0]);
      for (let k = 1; k < upright.length; k++) assert.ok(upright[k].position[0] >= upright[k - 1].position[0] + upright[k - 1].size[0], "dos libros se enciman");
      assert.ok(new Set(upright.map((p) => p.size[0])).size > 1, "todos del mismo espesor");
      const tilted = parts.filter((p) => p.rotationZ);
      assert.ok(tilted.length <= 1);
      for (const t of tilted) {
        const e = extent(t);
        assert.ok(e.min[1] >= -0.5 && e.min[1] < 1, `el recostado no apoya (${e.min[1]})`);
        const neighbour = lean === "end" ? upright[upright.length - 1] : upright[0];
        const gap = lean === "end" ? e.min[0] - (neighbour.position[0] + neighbour.size[0]) : neighbour.position[0] - e.max[0];
        assert.ok(gap >= -0.5 && gap < 3, `el recostado no toca al vecino (${gap})`);
        assert.ok(e.max[1] <= neighbour.size[1], "el recostado pasa al vecino");
      }
      for (const p of parts) assert.ok(extent(p).max[0] <= 100 + 320 + 0.5 && extent(p).min[0] >= 99.5 && extent(p).max[0] <= end + 0.5, "la hilera se pasa de su ancho");
    }
  }
  assert.equal(bookRow("r", 0, 0, 30, 250, 300, 150, 1).parts.length, 0, "en un hueco bajo no entran libros parados");
});

test("una pila de libros acostados: cada uno apoya en el de abajo y el de arriba es el más chico", () => {
  const { parts, top } = bookStack("p", 300, 100, 200, 4, 3);
  assert.equal(parts.length, 4);
  let y = 100;
  for (const [k, p] of parts.entries()) {
    assert.equal(p.position[1], y);
    y += p.size[1];
    if (k) assert.ok(p.size[0] < parts[k - 1].size[0] && p.size[2] < parts[k - 1].size[2]);
  }
  assert.equal(top, y);
});

test("la notebook y el cuadro: la pantalla y la lámina quedan del lado de adelante, recostadas hacia atrás", () => {
  const lap = laptop("n", 500, 750, 400);
  const base = lap.find((p) => p.id === "n:base")!;
  const lid = extent(lap.find((p) => p.id === "n:tapa")!);
  const screen = extent(lap.find((p) => p.id === "n:pantalla")!);
  assert.ok(Math.abs(lid.max[0] - lid.min[0] - base.size[0]) < 1, "la tapa no tiene el ancho de la base");
  assert.ok(lid.min[1] >= 750 && lid.max[1] > 750 + 190, "la tapa no está levantada");
  assert.ok(lid.max[2] <= base.position[2] + 30 && lid.min[2] >= base.position[2] - 80, "la tapa no nace del canto de atrás de la base");
  assert.ok(screen.max[2] > lid.max[2] - 6 && screen.min[1] > lid.min[1], "la pantalla no está en la cara de adelante de la tapa");
  const fr = frame("c", 0, 100, 20, 200, 250, 1);
  const body = extent(fr[0]);
  assert.ok(Math.abs(body.min[1] - 100) < 1 && body.min[2] >= 20 - 0.5 && body.min[2] < 21 && body.max[2] <= 20 + 50, `el cuadro no se recuesta contra el fondo (${body.min[2]} a ${body.max[2]})`);
  const middle = (p: Part) => (extent(p).min[2] + extent(p).max[2]) / 2;
  for (const p of fr.slice(1)) assert.ok(middle(p) > middle(fr[0]) + 5, `${p.id} queda detrás del marco`);
});

test("lo que se apoya en una tapa queda sobre la tapa, a su altura, sin asomar del borde", () => {
  const within = (parts: Part[], w: number, d: number, y: number, what: string) => {
    assert.ok(parts.length > 0, `${what}: nada apoyado`);
    assert.equal(new Set(parts.map((p) => p.id)).size, parts.length, `${what}: ids repetidos`);
    for (const p of parts) {
      const e = extent(p);
      assert.ok(e.min[1] >= y - 0.5, `${what} ${p.id}: se clava en la tapa`);
      assert.ok(e.min[0] >= -1 && e.max[0] <= w + 1 && e.min[2] >= -1 && e.max[2] <= d + 1, `${what} ${p.id}: asoma del borde (${e.min.map(Math.round)} a ${e.max.map(Math.round)}, tapa ${w}×${d})`);
    }
  };
  for (const [w, d] of [[600, 600], [800, 600], [1200, 650], [1600, 700], [2000, 950], [2500, 2500], [2500, 600], [600, 2500]]) {
    for (const round of [false, true]) {
      within(deskScene(w, d, 750, round), w, d, 750, `escritorio ${w}×${d}${round ? " redondo" : ""}`);
      within(diningScene(w, d, 750, round), w, d, 750, `mesa ${w}×${d}${round ? " redonda" : ""}`);
    }
  }
  for (const [w, d] of [[350, 300], [500, 400], [800, 500], [1200, 600], [1400, 800], [1400, 300], [350, 800]]) {
    within(coffeeScene(w, d, 360), w, d, 360, `ratona ${w}×${d}`);
    // la pantalla del velador puede asomar apenas de una mesa de luz muy chica, como en una de verdad
    for (const p of bedsideScene(w, d, 500)) {
      const e = extent(p);
      assert.ok(e.min[1] >= 499.5 && e.min[0] >= -45 && e.max[0] <= w + 45 && e.min[2] >= -5 && e.max[2] <= d + 5, `mesa de luz ${w}×${d} ${p.id}: asoma del borde`);
    }
  }
  for (const w of [1000, 1400, 2000, 2500])
    for (const inset of [0, 120]) {
      const bar = Math.min(w * 0.72 * 0.62, 950);
      const parts = tvTopScene(w, 420, 600, inset, bar);
      within(parts, w, 420, 600, `mueble de TV ${w}`);
      // nada de lo apoyado llega a la tele, que cuelga 280 mm arriba
      for (const p of parts) assert.ok(extent(p).max[1] <= 600 + 280 || extent(p).max[0] < w * 0.14 || extent(p).min[0] > w * 0.86, `mueble de TV ${w} ${p.id}: tapa la tele`);
    }
});

test("la ambientación de cada familia no toca el despiece ni el precio, en ninguna variante", () => {
  for (const spec of SPECS) {
    for (const config of variants(spec.id)) {
      const build = buildFurniture(config);
      const drawn = build.assembly.runs[0].parts;
      const decor = drawn.filter((p) => p.decor);
      const where = `${spec.id} ${JSON.stringify(config.values)}`;
      assert.ok(decor.length > 0, `${where}: se dibuja sin ningún contexto`);
      // el 3D usa el id de cada pieza como clave: no puede haber dos iguales
      assert.equal(new Set(drawn.map((p) => p.id)).size, drawn.length, `${where}: ids repetidos (${drawn.map((p) => p.id).filter((id, i, all) => all.indexOf(id) !== i)})`);
      for (const p of decor) {
        assert.equal(p.cut, null, `${where} ${p.id}: la ambientación no se corta`);
        assert.ok(p.size.every((s) => s > 0 && Number.isFinite(s)) && p.position.every(Number.isFinite), `${where} ${p.id}: sin medida`);
        assert.ok(extent(p).min[1] >= -1, `${where} ${p.id}: queda bajo el piso`);
        if (p.model) assert.ok(p.model in DECOR_MODELS, `${where} ${p.id}: no existe el modelo ${p.model}`);
        // un modelo se achica entero: su caja guarda las proporciones del original
        if (p.model) {
          const m = DECOR_MODELS[p.model as keyof typeof DECOR_MODELS];
          assert.ok(Math.abs(p.size[0] / m[0] - p.size[1] / m[1]) < 0.01 && Math.abs(p.size[2] / m[2] - p.size[1] / m[1]) < 0.01 && p.size[1] <= m[1] + 0.5, `${where} ${p.id}: modelo deformado o agrandado`);
        }
      }
      assert.ok(build.parts.every((p) => !p.decor), `${where}: la lista de piezas trae ambientación`);
      // sin la ambientación, el despiece y el precio son los mismos
      const bare = { ...build, assembly: { ...build.assembly, runs: [{ ...build.assembly.runs[0], parts: drawn.filter((p) => !p.decor) }] } };
      assert.deepEqual(cutList(build.parts), cutList(bare.assembly.runs[0].parts), `${where}: el despiece cambia con la ambientación`);
      assert.equal(furniturePrice(config, build), furniturePrice(config, bare), `${where}: el precio cambia con la ambientación`);
      const labels = new Set(cutList(build.parts).map((r) => r.label));
      for (const p of decor) assert.ok(!labels.has(p.label), `${where}: "${p.label}" aparece en el despiece`);
      assert.ok(decor.length <= 170, `${where}: ${decor.length} piezas de ambientación son demasiadas para un teléfono`);
    }
  }
});

test("lo que se apoya adentro de un mueble no atraviesa lo que tiene encima", () => {
  const cases: [string, Record<string, unknown>][] = [
    ["tv", {}],
    ["tv", { fronts: "abierto" }],
    ["tv", { fronts: "mixto", height: 350 }],
    ["tv", { fronts: "vidrio", height: 650, curved: true, thick: false }],
    ["bibliotecas", {}],
    ["bibliotecas", { doors: "no", shelves: 7, height: 900 }],
    ["bibliotecas", { structure: "hierro", shelves: 7, height: 1200, depth: 220 }],
    ["bibliotecas", { doors: "vidrio", width: 3200, height: 2500, depth: 450 }],
    ["camas", {}],
    ["camas", { width: 800 }],
    ["ratonas", {}],
    ["ratonas", { style: "vidrio", height: 280 }],
    ["ratonas", { style: "curva", drawers: 0, height: 700 }],
  ];
  for (const [family, values] of cases) {
    const drawn = buildFurniture(normalizeFurniture({ family, values })).assembly.runs[0].parts;
    const boards = drawn.filter((p) => !p.decor && p.geometry === "box" && p.kind !== "led" && p.kind !== "glow" && p.kind !== "back" && !p.front && p.size[1] <= 60 && p.size[0] > 150 && p.size[2] > 100);
    for (const p of drawn.filter((q) => q.decor && /^deco:(n|b|r|hb|bajo)/.test(q.id))) {
      const e = extent(p);
      for (const b of boards) {
        const over = b.position[0] < e.max[0] - 2 && b.position[0] + b.size[0] > e.min[0] + 2 && b.position[2] < e.max[2] - 2 && b.position[2] + b.size[2] > e.min[2] + 2;
        if (!over) continue;
        const [lo, hi] = [b.position[1], b.position[1] + b.size[1]];
        assert.ok(e.max[1] <= lo + 0.5 || e.min[1] >= hi - 0.5, `${family} ${JSON.stringify(values)}: ${p.id} atraviesa ${b.id} (${Math.round(e.min[1])} a ${Math.round(e.max[1])}, la placa de ${lo} a ${hi})`);
      }
    }
  }
});

test("los tiradores de barra son una varilla sobre dos pies, y van con su frente: no son piezas del despiece", () => {
  const tv = buildFurniture(normalizeFurniture({ family: "tv", values: { fronts: "mixto", grip: "barra" } }));
  const fronts = tv.parts.filter((p) => p.kind === "door" || p.kind === "drawer-front");
  assert.ok(fronts.length >= 3);
  for (const f of fronts) {
    const handle = f.details?.find((d) => d.kind === "handle");
    assert.ok(handle, `${f.id}: sin tirador`);
    assert.equal(handle.details?.length, 2, `${f.id}: el tirador no tiene sus dos pies`);
    // la varilla queda separada del frente y los pies llegan hasta él
    const thick = f.size[2];
    assert.ok(handle.position[2] > thick + 8, `${f.id}: la varilla está pegada al frente`);
    for (const foot of handle.details!) assert.ok(Math.abs(handle.position[2] + foot.position[2] - thick) < 0.5 && foot.position[2] + foot.size[2] >= 0, `${f.id}: un pie no une la varilla con el frente`);
  }
  assert.ok(tv.parts.every((p) => p.kind !== "handle"), "un tirador figura como pieza");
  // con uñero, la ranura no arrastra los pies del tirador
  const groove = buildFurniture(normalizeFurniture({ family: "tv", values: { fronts: "cajones", grip: "unero" } })).parts.find((p) => p.kind === "drawer-front")!;
  assert.ok(groove.details!.every((d) => d.kind === "groove" && !d.details));
  // las patas de caño llevan su regatón, que es parte de la pata
  const legs = tv.parts.filter((p) => p.label === "Pata");
  assert.ok(legs.length === 4 && buildFurniture(defaultFurniture("tv")).parts.filter((p) => p.label === "Pata").every((p) => p.details?.[0].label === "Regatón"));
});
