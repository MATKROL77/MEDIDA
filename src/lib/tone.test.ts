import assert from "node:assert/strict";
import { test } from "node:test";

import { neutralInverse, neutralTone, retone, type Rgb } from "./tone.ts";

const close = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps;

test("la curva de tonos deja los colores medios como son", () => {
  // una madera a media luz: sale casi igual (apenas más contrastada), sin lavarse
  const wood: Rgb = [0.42, 0.26, 0.14];
  const out = neutralTone(wood);
  for (let k = 0; k < 3; k++) assert.ok(close(out[k], wood[k] - 0.04));
  // el tono no cambia: la diferencia entre canales es la misma
  assert.ok(close(out[0] - out[2], wood[0] - wood[2]));
});

test("los blancos se aprietan sin quemarse y siempre crecen", () => {
  let last = 0;
  for (let v = 0.05; v < 6; v += 0.05) {
    const out = neutralTone([v, v, v])[0];
    assert.ok(out > last, `no crece en ${v}`);
    assert.ok(out < 1, `se quema en ${v}`);
    last = out;
  }
  // una melamina blanca a plena luz queda bien arriba, no gris
  assert.ok(neutralTone([0.9, 0.89, 0.86])[0] > 0.82);
});

test("el negro queda negro y no hay valores negativos", () => {
  assert.deepEqual(neutralTone([0, 0, 0]), [0, 0, 0]);
  for (const v of [0.005, 0.02, 0.07, 0.08, 0.1]) assert.ok(neutralTone([v, v, v])[0] >= 0);
});

test("la curva al revés devuelve el color pedido", () => {
  // el beige de la página, el gris del estudio, un azul oscuro, un casi negro y un color vivo
  const colors: Rgb[] = [
    [0.76, 0.7, 0.61],
    [0.87, 0.86, 0.84],
    [0.05, 0.08, 0.16],
    [0.004, 0.006, 0.01],
    [0.95, 0.4, 0.1],
  ];
  for (const c of colors) {
    const out = neutralTone(neutralInverse(c));
    for (let i = 0; i < 3; i++) assert.ok(close(out[i], c[i], 1e-6), `${c}: ${out}`);
  }
});

test("el fondo liso claro entra con más luz de la que sale", () => {
  const studio: Rgb = [0.87, 0.86, 0.84];
  const input = neutralInverse(studio);
  for (let i = 0; i < 3; i++) assert.ok(input[i] > studio[i] && input[i] < studio[i] * 1.4);
});

test("el blanco puro y el negro no rompen la curva al revés", () => {
  const white = neutralInverse([1, 1, 1]);
  for (const v of white) assert.ok(Number.isFinite(v) && v > 1);
  assert.ok(neutralTone(white)[0] > 0.98);
  assert.deepEqual(neutralInverse([0, 0, 0]), [0, 0, 0]);
});

test("un piso llevado a otro tono queda con el promedio pedido y conserva la veta", () => {
  // cuatro píxeles de una madera oscura: dos más claros y dos más oscuros que su promedio
  const from: Rgb = [160, 118, 84];
  const pixels = [170, 128, 94, 255, 150, 108, 74, 255, 180, 130, 90, 200, 140, 106, 78, 255];
  const before = [...pixels];
  const to: Rgb = [203, 178, 150];
  retone(pixels, from, to);
  for (let k = 0; k < 3; k++) {
    const average = (pixels[k] + pixels[4 + k] + pixels[8 + k] + pixels[12 + k]) / 4;
    assert.ok(Math.abs(average - to[k]) <= 1, `canal ${k}: ${average}`);
  }
  // cada píxel se aparta del promedio nuevo lo mismo que se apartaba del viejo
  assert.equal(pixels[0] - to[0], before[0] - from[0]);
  assert.equal(pixels[5] - to[1], before[5] - from[1]);
  // la transparencia no se toca
  assert.deepEqual([pixels[3], pixels[11]], [255, 200]);
});

test("con menos contraste y sin color la veta se calma y queda en grises", () => {
  const from: Rgb = [160, 118, 84];
  const to: Rgb = [200, 180, 150];
  const pixels = [190, 128, 70, 255];
  retone(pixels, from, to, 0.5, 0);
  // la diferencia queda igual en los tres canales: solo luz
  const d = [pixels[0] - to[0], pixels[1] - to[1], pixels[2] - to[2]];
  assert.ok(d[0] === d[1] && d[1] === d[2]);
  // y es la mitad de la luz que traía: 0,299·30 + 0,587·10 − 0,114·14 ≈ 13,2
  assert.equal(d[0], 7);
});

test("un tono muy claro no se pasa de blanco", () => {
  const pixels = [250, 250, 250, 255, 0, 0, 0, 255];
  retone(pixels, [125, 125, 125], [240, 240, 240], 2);
  assert.deepEqual(pixels.slice(0, 3), [255, 255, 255]);
  assert.deepEqual(pixels.slice(4, 7), [0, 0, 0]);
});
