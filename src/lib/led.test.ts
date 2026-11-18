import assert from "node:assert/strict";
import { test } from "node:test";

import type { Part } from "./assembly.ts";
import { buildFurniture, defaultFurniture, normalizeFurniture, SPECS } from "./furniture.ts";
import { fluence, frame, halo, irradiance, lightUp, washMesh, type Wash } from "./led.ts";
import { DEFAULT_CONFIG, normalize } from "./model.ts";
import { quote } from "./quote.ts";

const partsOf = (family: string, values: Record<string, unknown> = {}) => {
  const base = defaultFurniture(family);
  return buildFurniture(normalizeFurniture({ ...base, values: { ...base.values, ...values } })).assembly.runs[0].parts;
};
const lit = (parts: Part[]) => parts.filter((p) => p.kind === "glow");

test("la luz de una tira es más fuerte cerca y se apaga con la distancia", () => {
  const up: [number, number, number] = [0, 1, 0];
  // el piso del hueco, justo abajo del medio de una tira de 80 cm, cada vez más lejos
  const under = [0.1, 0.2, 0.4, 0.8, 1.6].map((h) => irradiance([0.4, -h, 0], up, 0.8));
  for (let i = 1; i < under.length; i++) assert.ok(under[i] < under[i - 1], `a ${i} no baja`);
  // y hacia el fondo del estante, alejándose de la tira
  const away = [0, 0.1, 0.2, 0.4].map((z) => irradiance([0.4, -0.3, -z], up, 0.8));
  for (let i = 1; i < away.length; i++) assert.ok(away[i] < away[i - 1]);
  // pasando la punta de la tira se apaga sin cortar en seco
  const past = [0.4, 0.8, 0.9, 1.1, 1.5].map((x) => irradiance([x, -0.3, 0], up, 0.8));
  for (let i = 1; i < past.length; i++) assert.ok(past[i] < past[i - 1]);
  assert.ok(past[2] > past[0] * 0.2, "la punta no corta en seco");
  // es pareja a los dos lados del medio
  assert.ok(Math.abs(irradiance([0.1, -0.3, 0.05], up, 0.8) - irradiance([0.7, -0.3, 0.05], up, 0.8)) < 1e-9);
});

test("la tira alumbra para su lado: arriba de su plano no llega nada, y una cara de espaldas tampoco", () => {
  assert.equal(irradiance([0.4, 0.05, 0], [0, -1, 0], 0.8), 0);
  assert.equal(fluence([0.4, 0.05, 0], 0.8), 0);
  // una placa abajo de la tira, mirando hacia abajo, no recibe
  assert.equal(irradiance([0.4, -0.3, 0], [0, -1, 0], 0.8), 0);
  // el fondo, detrás de la tira, recibe más arriba que abajo: la luz baja por la pared
  const back: [number, number, number] = [0, 0, 1];
  assert.ok(irradiance([0.4, -0.1, -0.45], back, 0.8) > irradiance([0.4, -0.5, -0.45], back, 0.8));
  // el lateral, junto a la punta de la tira, recibe; el de la otra punta, lejos, mucho menos
  const side: [number, number, number] = [1, 0, 0];
  const near = irradiance([-0.015, -0.1, 0], side, 0.8);
  assert.ok(near > 0 && near > irradiance([-0.6, -0.1, 0], side, 0.8) * 4);
  // el resplandor sobre la placa que lleva la tira se apaga a pocos centímetros
  assert.ok(halo([0.4, 0, 0.005], 0.8) > 0.8);
  assert.ok(halo([0.4, 0, 0.15], 0.8) < 0.12);
});

test("las caras de una luz salen en una sola malla, cada vértice con su lugar respecto de la tira", () => {
  const wash: Wash = { from: [15, 291, 480], axis: 0, length: 770, emit: [1, -1], faces: ["z0", "y0", "y1", "x0", "x1", "air"], carrier: "y1", airAt: 560 };
  const mesh = washMesh([800, 300, 500], wash);
  assert.equal(mesh.position.length, 6 * 4 * 3);
  assert.equal(mesh.index.length, 6 * 6);
  assert.equal(mesh.rel.length, mesh.position.length);
  assert.equal(mesh.aim.length, 6 * 4 * 4);
  // nada se sale de la caja (la cortina va adelante, donde se pidió)
  for (let i = 0; i < mesh.position.length; i += 3) {
    assert.ok(Math.abs(mesh.position[i]) <= 400 && Math.abs(mesh.position[i + 1]) <= 150);
    assert.ok(mesh.position[i + 2] >= -250 && mesh.position[i + 2] <= 560 - 250);
  }
  // el fondo queda detrás de la tira y abajo de ella, en metros
  for (let v = 0; v < 4; v++) {
    assert.ok(Math.abs(mesh.rel[v * 3 + 2] - -0.479) < 1e-9);
    assert.ok(mesh.rel[v * 3 + 1] <= 0.009 + 1e-9);
    assert.deepEqual(mesh.aim.slice(v * 4, v * 4 + 4), [0, 0, 1, 0]);
  }
  // la cara que lleva la tira va marcada, y la cortina también
  const kinds = [0, 1, 2, 3, 4, 5].map((f) => mesh.aim[f * 16 + 3]);
  assert.deepEqual(kinds, [0, 0, 2, 0, 0, 1]);
  // un perfil parado que alumbra hacia +x: lo que queda a su derecha está "abajo" de la tira
  const axes = frame({ axis: 1, emit: [0, 1] }).map((v) => v.map((n) => n + 0));
  assert.deepEqual(axes, [[0, 1, 0], [-1, 0, 0], [0, 0, 1]]);
});

test("cada tira de cada mueble tiene su luz, y sin luces no queda ninguna", () => {
  const cases: [string, Record<string, unknown>][] = [
    ["tv", {}],
    ["tv", { fronts: "mixto", base: "flotante" }],
    ["tv", { fronts: "abierto", curved: true }],
    ["camas", {}],
    ["camas", { base: "patas", head: "madera", sides: "no", foot: "liso" }],
    ["camas", { base: "flotante", head: "tapizado", sides: "no", foot: "liso" }],
    ["ratonas", { led: true }],
    ["ratonas", { led: true, style: "clasica", kind: "luz", drawers: 2 }],
    ["ratonas", { led: true, style: "losa" }],
    ["ratonas", { led: true, style: "vidrio" }],
    ["mesas", { led: true }],
    ["bibliotecas", { led: true }],
  ];
  for (const [family, values] of cases) {
    const parts = partsOf(family, values);
    const strips = parts.filter((p) => p.kind === "led");
    assert.ok(strips.length > 0, `${family}: no hay tiras`);
    for (const s of strips) {
      const glow = parts.find((p) => p.id === `${s.id}:luz`);
      assert.ok(glow?.wash, `${family} ${JSON.stringify(values)}: ${s.id} no alumbra nada`);
      // la luz no entra en el despiece ni en el precio, y sale con el cajón si la tira es de un cajón
      assert.equal(glow.cut, null);
      assert.deepEqual(glow.openShift, s.openShift);
      // el piso del hueco recibe siempre, y la tira queda arriba de la caja, alumbrando hacia abajo
      assert.ok(glow.wash.faces.includes("y0"));
      assert.ok(glow.size.every((v) => v >= 20), `${s.id}: caja sin volumen`);
      assert.ok(glow.wash.from[1] <= glow.size[1] && glow.wash.from[1] >= glow.size[1] - 20);
    }
  }
  for (const spec of SPECS) {
    const parts = partsOf(spec.id, { led: false });
    assert.equal(parts.filter((p) => p.kind === "led").length, 0, `${spec.id}: quedó una tira`);
    assert.equal(lit(parts).length, 0, `${spec.id}: quedó una luz sin tira`);
  }
});

test("el nicho del mueble de TV se alumbra entero: piso, fondo, laterales y lo que tiene adentro", () => {
  const parts = partsOf("tv");
  const glow = parts.find((p) => p.id === "led:niche:luz")!;
  assert.deepEqual([...glow.wash!.faces].sort(), ["air", "x0", "x1", "y0", "y1", "z0"]);
  const shelf = parts.find((p) => p.id === "shelf")!;
  const top = parts.find((p) => p.id === "top")!;
  assert.equal(glow.position[1], shelf.position[1] + shelf.size[1]);
  assert.equal(glow.position[1] + glow.size[1], top.position[1]);
  // bajo una cama con patas no hay paredes: un charco en el piso que se apaga solo
  const bed = partsOf("camas", { base: "patas", head: "madera", sides: "no", foot: "liso" });
  const pool = bed.find((p) => p.id === "led:luz")!;
  assert.deepEqual(pool.wash!.faces, ["y0"]);
  assert.deepEqual([...pool.wash!.open!].sort(), ["x0", "x1", "z0", "z1"]);
  assert.ok(pool.position[1] < 10);
});

test("una tira sobre un cajón ajeno no deja una luz quieta, y la decoración no cuenta como pared", () => {
  const box = (id: string, position: [number, number, number], size: [number, number, number], extra: Partial<Part> = {}): Part => ({ id, label: id, kind: "shelf", material: "roble", run: 0, module: null, position, size, geometry: "box", cut: null, explode: [0, 0, 0], ...extra });
  const strip = box("led", [20, 292, 300], [760, 8, 14], { kind: "led", material: "led" });
  // un estante abajo y una caja de adorno que llega casi al techo del hueco
  const open = [strip, box("piso", [0, 0, 0], [800, 18, 400]), box("deco:caja", [0, 18, 0], [18, 280, 400], { decor: true })];
  lightUp(open);
  const wash = open.find((p) => p.id === "led:luz")!.wash!;
  assert.ok(!wash.faces.includes("x0"), "la decoración no es una pared");
  // con un cajón justo abajo de la tira, no hay dónde dejar la luz
  const blocked = [{ ...strip }, box("piso", [0, 0, 0], [800, 18, 400]), box("cajon", [0, 100, 0], [800, 150, 400], { module: 0, openShift: [0, 0, 300] })];
  lightUp(blocked);
  assert.equal(lit(blocked).length, 0);
});

test("en el placard, cada tira lleva la luz de su hueco y los perfiles de los laterales alumbran hacia adentro", () => {
  const config = normalize({ ...DEFAULT_CONFIG, runs: [{ width: 2400, modules: DEFAULT_CONFIG.runs[0].modules.map((m) => ({ ...m, ledShelves: true, ledSides: true })) }] });
  const parts = quote(config).assembly.runs.flatMap((r) => r.parts);
  const strips = parts.filter((p) => p.kind === "led");
  const washes = lit(parts);
  assert.ok(strips.length > 4);
  assert.equal(washes.length, strips.length);
  for (const w of washes) {
    assert.ok(w.wash, `${w.id} sin caras`);
    assert.ok(w.wash.faces.includes("air") && w.wash.faces.includes("z0"));
    const vertical = w.wash.axis === 1;
    const strip = parts.find((p) => p.id === (vertical ? w.id.replace(":luz", ":led") : w.id.replace(/:luz$/, ":led")))!;
    assert.ok(strip, `${w.id} sin tira`);
    // la tira queda dentro del ancho de su hueco
    assert.ok(strip.position[0] >= w.position[0] - 0.5 && strip.position[0] + strip.size[0] <= w.position[0] + w.size[0] + 0.5);
    if (vertical) {
      // el de la izquierda alumbra hacia la derecha y va montado en su lateral
      const left = /luzL$/.test(w.id);
      assert.deepEqual(w.wash.emit, [0, left ? 1 : -1]);
      assert.equal(w.wash.carrier, left ? "x0" : "x1");
    } else assert.deepEqual(w.wash.emit, [1, -1]);
  }
  // sin luces elegidas no queda ni una tira ni una luz
  const dark = normalize({ ...DEFAULT_CONFIG, runs: [{ width: 2400, modules: DEFAULT_CONFIG.runs[0].modules.map((m) => ({ ...m, ledShelves: false, ledSides: false })) }] });
  const none = quote(dark).assembly.runs.flatMap((r) => r.parts);
  assert.equal(none.filter((p) => p.kind === "led" || p.kind === "glow").length, 0);
});
