import assert from "node:assert/strict";
import { test } from "node:test";

import { aspectReach, shrinkZoom } from "./framing.ts";

test("el visor del teléfono achicado encuadra igual que un lienzo de ese alto", () => {
  // sin achicar, la cámara queda donde está
  assert.equal(shrinkZoom(390, 518, 518), 1);
  // achicado: el mueble ocupa en el recorte lo mismo que ocuparía en un lienzo de ese alto
  const width = 390;
  const big = 518;
  const small = 305;
  const zoom = shrinkZoom(width, big, small);
  // píxeles por metro en el recorte con la cámara del lienzo grande y el acercamiento…
  const cropped = (big * zoom) / aspectReach(width / big);
  // …y en un lienzo chico con la cámara encuadrada para él
  const native = small / aspectReach(width / small);
  assert.ok(Math.abs(cropped - native) < 1e-9);
  // se aleja, pero menos de lo que se achica: el visor chico es apaisado y encuadra más ajustado
  assert.ok(zoom < 1 && zoom > small / big);
});

test("un visor sin alto no rompe el acercamiento", () => {
  assert.equal(shrinkZoom(390, 0, 300), 1);
  assert.equal(shrinkZoom(390, 518, 0), 1);
});
