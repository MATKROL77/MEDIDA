import assert from "node:assert/strict";
import { test } from "node:test";

import { garmentGeometry } from "../components/viewer/garments.ts";
import type { GarmentShape } from "./assembly.ts";
import { dressed, HANGER_HEIGHT, HUNG, type HungShape } from "./decor.ts";
import { DEFAULT_CONFIG, normalize, type Layout, type ModuleConfig } from "./model.ts";
import { quote } from "./quote.ts";

/** una pieza de cada forma, a su medida de siempre */
const SAMPLES: [GarmentShape, number, number[], string[]?][] = [
  ...(Object.keys(HUNG) as HungShape[]).flatMap((shape) => [0, 1, 2].map((v): [GarmentShape, number, number[]] => [shape, v, [HUNG[shape].t, HUNG[shape].len[v], HUNG[shape].w]])),
  // en un placard playo las prendas van más angostas, y en uno bajo, más cortas
  ["shirt", 1, [54, 600, 380]],
  ["tee", 0, [44, 520, 360]],
  ["hanger", 0, [14, HANGER_HEIGHT, 420], ["#d2b48a", "#b9bcc0"]],
  ["hanger", 1, [14, HANGER_HEIGHT, 376], ["#262627", "#b9bcc0"]],
  ["hanger", 2, [14, HANGER_HEIGHT, 420], ["#c9a877", "#b9bcc0"]],
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((v): [GarmentShape, number, number[]] => ["folded", v, v < 4 ? [250, 26, 300] : v < 8 ? [238, 40, 312] : [272, 56, 316]]),
  ...[0, 1].map((v): [GarmentShape, number, number[], string[]] => ["shoe", v, [98, 112, 286], ["#f1efea", "#f6f4ef", "#e9e6df"]]),
  ...[2, 3].map((v): [GarmentShape, number, number[], string[]] => ["shoe", v, [96, 72, 292], ["#6b4a34", "#2a211c", "#3a2a20"]]),
  ...[4, 5].map((v): [GarmentShape, number, number[], string[]] => ["shoe", v, [100, 168, 290], ["#5a4636", "#2a211c", "#3a2a20"]]),
  ["box", 0, [310, 230, 380], ["#eeeae2", "#8f8a80"]],
  ["box", 1, [310, 200, 380], ["#5d6066", "#c9c5bc"]],
  ["box", 2, [330, 120, 400], ["#d3ccbe", "#7a5a40"]],
  ["basket", 0, [340, 250, 300], ["#c2a374"]],
  ["basket", 1, [320, 240, 300], ["#a98a5c"]],
];

test("cada forma entra en su caja, es liviana y lleva lo que el visor y el trazado de rayos necesitan", () => {
  for (const [shape, variant, size, colors] of SAMPLES) {
    const name = `${shape} ${variant} (${size.join("×")})`;
    const g = garmentGeometry({ shape, variant, colors }, size);
    for (const attr of ["position", "normal", "uv", "color"]) assert.ok(g.getAttribute(attr), `${name}: falta ${attr}`);
    const pos = g.getAttribute("position");
    const nor = g.getAttribute("normal");
    const col = g.getAttribute("color");
    // RGBA: con tres componentes el trazado de rayos no copia el color y la prenda sale negra
    assert.equal(col.itemSize, 4, `${name}: el color tiene que ser RGBA`);
    assert.ok(g.getIndex(), `${name}: sin índice`);
    const triangles = g.getIndex()!.count / 3;
    assert.ok(triangles >= 100 && triangles <= 1300, `${name}: ${triangles} triángulos`);
    for (let i = 0; i < pos.count; i++) {
      for (let k = 0; k < 3; k++) {
        const v = pos.getComponent(i, k) * 1000;
        assert.ok(Number.isFinite(v), `${name}: posición inválida`);
        // adentro de su caja (centrada), con un milímetro y medio de gracia
        assert.ok(Math.abs(v) <= size[k] / 2 + 1.5, `${name}: se sale ${(Math.abs(v) - size[k] / 2).toFixed(1)} mm de su caja en el eje ${k}`);
        const c = col.getComponent(i, k);
        // un color nunca devuelve más luz de la que recibe
        assert.ok(c >= 0 && c <= 1, `${name}: color fuera de rango`);
      }
      const n = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i));
      assert.ok(Math.abs(n - 1) < 1e-3, `${name}: normal sin normalizar`);
    }
    // llena su caja: lo que se dibuja mide lo que dice la pieza (y apoya en su base)
    g.computeBoundingBox();
    const box = g.boundingBox!;
    // (la percha cuelga del gancho: su caja deja lugar para la varilla, que no todas llevan)
    if (shape !== "hanger") assert.ok(box.min.y * 1000 < -size[1] / 2 + 3, `${name}: no llega a la base de su caja`);
    assert.ok(box.max.y * 1000 > size[1] / 2 - 6, `${name}: no llega al tope de su caja`);
    // la misma forma no se arma dos veces
    assert.equal(garmentGeometry({ shape, variant, colors }, size), g, `${name}: no se comparte`);
    assert.equal(g.userData.shared, true);
  }
});

test("un placard grande vestido entra en el presupuesto de triángulos y comparte geometrías", () => {
  const mod = (layout: Layout, extra: Partial<ModuleConfig> = {}): ModuleConfig => ({ layout, width: 1000, shelves: 3, drawers: 2, ledShelves: false, ledSides: false, ...extra });
  const big = normalize({
    ...DEFAULT_CONFIG,
    shape: "l-left",
    runs: [
      { width: 4000, modules: [mod("double-hanging"), mod("hanging"), mod("shelves", { shelves: 6 }), mod("double-hanging")] },
      { width: 3000, modules: [mod("double-hanging"), mod("hanging")] },
    ],
  });
  for (const [config, parts, budget] of [
    [DEFAULT_CONFIG, 110, 60_000],
    [big, 320, 160_000],
  ] as const) {
    const decor = dressed(quote(config).assembly).runs.flatMap((r) => r.parts.filter((p) => p.decor));
    const shapes = new Set(decor.map((p) => garmentGeometry(p.garment!, p.size)));
    const triangles = decor.reduce((sum, p) => sum + garmentGeometry(p.garment!, p.size).getIndex()!.count / 3, 0);
    assert.ok(decor.length <= parts, `${decor.length} piezas de ambientación`);
    assert.ok(triangles <= budget, `${triangles} triángulos de ambientación`);
    assert.ok(shapes.size <= decor.length / 2 + 20, `${shapes.size} geometrías para ${decor.length} piezas`);
  }
});
