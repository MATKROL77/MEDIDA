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
      assert.ok(parts.length >= 3, `${spec.id}: muy pocas piezas`);
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
  const sillon = normalizeFurniture({ family: "sillones", values: { style: "recto", seats: 3, seatWidth: 900, arms: true, chaise: "no", ottoman: false } });
  assert.equal(furnitureSummary(sillon).dimensions.split(" × ")[0], "308", "tres cuerpos de 90 más dos apoyabrazos de 19");
});

test("agrandar o sumar cosas nunca abarata, y el precio es un número redondo", () => {
  for (const spec of SPECS) {
    const [base, small, big] = variants(spec.id);
    const prices = [small, base, big].map((c) => furniturePrice(c));
    assert.ok(prices[0] <= prices[1] && prices[1] <= prices[2], `${spec.id}: ${prices}`);
    assert.ok(prices.every((p) => p > 0 && p % 1000 === 0));
  }
  const sin = furniturePrice(normalizeFurniture({ family: "mesas", values: { kind: "escritorio", legs: "panel" } }));
  const con = furniturePrice(normalizeFurniture({ family: "mesas", values: { kind: "escritorio", legs: "pedestal" } }));
  assert.ok(con > sin, "la cajonera suma");
  const apagada = furniturePrice(normalizeFurniture({ family: "tv", values: { led: false } }));
  const prendida = furniturePrice(normalizeFurniture({ family: "tv", values: { led: true } }));
  assert.ok(prendida > apagada, "la luz LED suma");
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
  assert.equal(tv.values.fronts, "nicho-cajon", "una opción que no existe vuelve a la de partida");
});

test("cajones y puertas se cuentan como lo que se ve", () => {
  const tv = buildFurniture(normalizeFurniture({ family: "tv", values: { width: 1800, fronts: "puertas" } }));
  assert.equal(tv.doors, 3);
  assert.equal(tv.parts.filter((p) => p.kind === "door").length, 3);
  const luz = buildFurniture(normalizeFurniture({ family: "ratonas", values: { kind: "luz", style: "clasica", height: 600, drawers: 2 } }));
  assert.equal(luz.drawers, 2);
  assert.ok(luz.parts.filter((p) => p.kind === "drawer-front").every((p) => p.openShift && p.openShift[2] > 0), "los cajones salen hacia adelante");
});

test("la ambientación no es parte del mueble: ni se mide, ni se corta, ni se cobra", () => {
  for (const spec of SPECS) {
    const config = defaultFurniture(spec.id);
    const { parts, assembly } = buildFurniture(config);
    assert.ok(parts.every((p) => !p.decor), `${spec.id}: la lista de piezas trae ambientación`);
    const drawn = assembly.runs[0].parts;
    assert.ok(drawn.some((p) => p.decor), `${spec.id}: se dibuja sin ningún contexto`);
    assert.ok(drawn.filter((p) => p.decor).every((p) => p.cut === null));
  }
  // la mesa y la ratona van en el medio del ambiente; lo demás, contra la pared
  assert.ok(buildFurniture(defaultFurniture("mesas")).assembly.bounds.min[2] > 1500);
  assert.ok(buildFurniture(defaultFurniture("ratonas")).assembly.bounds.min[2] > 1500);
  assert.equal(buildFurniture(defaultFurniture("tv")).assembly.bounds.min[2], 0);
  assert.equal(buildFurniture(defaultFurniture("bibliotecas")).assembly.bounds.min[2], 0);
});

test("un sillón al piso no tiene patas, y con patas quedan debajo del cuerpo", () => {
  const piso = buildFurniture(normalizeFurniture({ family: "sillones", values: { base: "piso" } }));
  assert.equal(piso.parts.filter((p) => p.label === "Pata").length, 0);
  const patas = buildFurniture(normalizeFurniture({ family: "sillones", values: { base: "patas" } }));
  const { min, max } = patas.assembly.bounds;
  const legs = patas.parts.filter((p) => p.label === "Pata");
  assert.ok(legs.length >= 4);
  for (const l of legs) assert.ok(l.position[0] > min[0] + 40 && l.position[0] + l.size[0] < max[0] - 40 && l.position[2] > min[2] + 40, `${l.id} asoma`);
});

test("la habitación envuelve al mueble y a lo que lo acompaña", () => {
  for (const spec of SPECS) {
    const { assembly } = buildFurniture(defaultFurniture(spec.id));
    const room = assembly.room!;
    for (const p of assembly.runs[0].parts) {
      if (p.kind === "glow") continue;
      assert.ok(p.position[0] >= room.min[0] && p.position[0] + p.size[0] <= room.max[0], `${spec.id} ${p.id}: una pared lo atraviesa`);
    }
  }
});

test("el sillón curvo es una pieza de diseño: asiento y respaldo barridos sobre una curva libre, con zócalo y mesita", () => {
  const curvo = buildFurniture(normalizeFurniture({ family: "sillones", values: { style: "curvo", seats: 3, bow: 500, table: "izquierda" } }));
  for (const id of ["plinth", "seat", "backrest"]) {
    const p = curvo.parts.find((x) => x.id === id);
    assert.ok(p?.geometry === "sweep" && p.sweep && p.sweep.path.length > 10, `${id} tiene que ser una pieza barrida`);
    // la caja de la pieza contiene el recorrido
    for (const [x, z] of [p.sweep.path[0], p.sweep.path[p.sweep.path.length - 1]]) {
      assert.ok(x >= p.position[0] - 1 && x <= p.position[0] + p.size[0] + 1 && z >= p.position[2] - 600 && z <= p.position[2] + p.size[2] + 600, `${id}: la punta queda fuera de su caja`);
    }
  }
  // el respaldo es más alto en la punta de la mesita
  const back = curvo.parts.find((p) => p.id === "backrest")!.sweep!.heights;
  assert.ok(back[0] > back[back.length - 1]);
  // la curvatura se nota: el medio del recorrido queda más atrás que las puntas
  const path = curvo.parts.find((p) => p.id === "seat")!.sweep!.path;
  assert.ok(path[Math.floor(path.length / 2)][1] < path[0][1] - 300);
  // la mesita: madera doblada (MDF flexible en el despiece) y tapa de piedra
  assert.ok(curvo.parts.some((p) => p.id === "table:stone" && p.material.startsWith("stone:")));
  assert.ok(curvo.parts.filter((p) => p.geometry === "bend").every((p) => /MDF flexible/.test(p.cut?.note ?? "")));
  // sin apoyabrazos ni puff: el respaldo da la vuelta y va la mesita
  const locked = normalizeFurniture({ family: "sillones", values: { style: "curvo", arms: true, ottoman: true } });
  assert.equal(locked.values.arms, false);
  assert.equal(locked.values.ottoman, false);
});

test("el puff del sillón recto va pegado al frente", () => {
  const recto = buildFurniture(normalizeFurniture({ family: "sillones", values: { style: "recto", seats: 3, ottoman: true, depth: 980 } }));
  const puff = recto.parts.find((p) => p.id === "ott:base")!;
  // la base es una sola, de punta a punta
  const base = recto.parts.find((p) => p.id === "base")!;
  const front = base.position[2] + base.size[2];
  assert.ok(Math.abs(puff.position[2] - front) < 5, `el puff está a ${Math.round(puff.position[2] - front)} mm del sillón`);
});

test("la ropa del placard se dibuja pero no toca el despiece ni el precio", async () => {
  const { dressed, undressed } = await import("./decor.ts");
  const { DEFAULT_CONFIG } = await import("./model.ts");
  const { quote } = await import("./quote.ts");
  const q = quote(DEFAULT_CONFIG);
  const withClothes = dressed(q.assembly);
  const added = withClothes.runs[0].parts.filter((p) => p.decor);
  assert.ok(added.some((p) => p.label === "Ropa colgada") && added.some((p) => p.label === "Ropa doblada"), "falta ropa colgada o doblada");
  assert.ok(added.every((p) => p.cut === null && p.size.every((s) => s > 0)));
  assert.equal(q.assembly.runs[0].parts.filter((p) => p.decor).length, 0, "el despiece no se toca");
  // la ropa colgada no atraviesa lo que hay debajo
  const solid = q.assembly.runs[0].parts.filter((p) => ["bottom", "shelf", "fixed-shelf", "drawer-front"].includes(p.kind));
  for (const c of added.filter((p) => p.label === "Ropa colgada")) {
    for (const s of solid) {
      const overlapX = s.position[0] < c.position[0] + c.size[0] && s.position[0] + s.size[0] > c.position[0];
      const top = s.position[1] + s.size[1];
      assert.ok(!overlapX || top <= c.position[1] || s.position[1] >= c.position[1] + c.size[1], `${c.id} atraviesa ${s.id}`);
    }
  }
  const bare = undressed(buildFurniture(defaultFurniture("tv")).assembly);
  assert.equal(bare.runs[0].parts.filter((p) => p.decor).length, 0);
});

test("cama con guardado: caja cerrada con piso falso, y cajones con su pared de atrás", () => {
  const cama = buildFurniture(defaultFurniture("camas"));
  const parts = cama.parts;
  assert.ok(parts.some((p) => p.label === "Piso falso"), "falta el piso falso");
  assert.ok(parts.some((p) => p.label === "Pared de fondo del guardado"), "las puertas de los pies no tienen fondo");
  assert.ok(parts.some((p) => p.label === "Pared del guardado lateral"), "los cajones del costado no tienen contra qué correr");
  const fronts = parts.filter((p) => p.kind === "drawer-front");
  assert.ok(fronts.length >= 2);
  for (const f of fronts) {
    const box = parts.filter((p) => p.module === f.module && p.id !== f.id);
    assert.ok(box.some((p) => p.kind === "drawer-end"), `${f.id}: el cajón no tiene contrafrente`);
    assert.equal(box.filter((p) => p.kind === "drawer-side").length, 2, `${f.id}: le faltan laterales`);
    assert.ok(box.some((p) => p.kind === "drawer-bottom"), `${f.id}: no tiene fondo`);
  }
  // las puertas de los pies son rebatibles y caben delante de su compartimento
  const doors = parts.filter((p) => p.kind === "door");
  assert.equal(doors.length, 2);
  assert.ok(doors.every((d) => d.hinge === "bottom"));
  // los cajones del costado no se meten en el compartimento de los pies
  const wall = parts.find((p) => p.label === "Pared de fondo del guardado")!;
  for (const p of parts.filter((x) => x.module !== null && x.module >= 10)) assert.ok(p.position[2] + p.size[2] <= wall.position[2] + 1, `${p.id} choca con el guardado de los pies`);
  // las cajas de los cajones entran en lo que hay de profundidad
  for (const p of parts.filter((x) => x.kind === "drawer-side")) assert.ok(p.size.every((n) => n > 0));
});

test("cama: las restricciones apagan lo que no se puede", () => {
  const conPatas = normalizeFurniture({ family: "camas", values: { base: "patas", sides: "ambos", foot: "cajones" } });
  assert.equal(conPatas.values.sides, "no", "con patas no hay cajones al costado");
  assert.equal(conPatas.values.foot, "liso");
  const baja = normalizeFurniture({ family: "camas", values: { base: "caja", height: 250, sides: "derecha", foot: "puertas" } });
  assert.equal(baja.values.sides, "no", "una base baja no lleva cajones");
  assert.equal(baja.values.foot, "liso");
  const tapizada = normalizeFurniture({ family: "camas", values: { upholstered: true, sides: "izquierda" } });
  assert.equal(tapizada.values.sides, "no");
  const sinLuz = normalizeFurniture({ family: "camas", values: { base: "caja", head: "tapizado", sides: "no", foot: "liso", led: true } });
  assert.equal(sinLuz.values.led, false, "la luz no va donde no se ve");
  const conTrampilla = normalizeFurniture({ family: "camas", values: { lid: true, sides: "ambos", foot: "cajones" } });
  assert.equal(conTrampilla.values.sides, "no", "con trampilla el guardado es por arriba");
  assert.equal(conTrampilla.values.foot, "liso");
  const angosta = normalizeFurniture({ family: "camas", values: { width: 900, sides: "ambos" } });
  assert.notEqual(angosta.values.sides, "ambos", "en una de una plaza no entran cajones de los dos lados");
  const sinGuardado = buildFurniture(normalizeFurniture({ family: "camas", values: { base: "patas" } }));
  assert.ok(sinGuardado.parts.some((p) => p.label === "Tabla del elástico"), "sin guardado, el colchón va sobre tablas");
  assert.ok(!sinGuardado.parts.some((p) => p.label === "Piso falso"));
});

test("cama: cajones de los dos lados, trampilla y puertas en el respaldo", () => {
  const ambos = buildFurniture(normalizeFurniture({ family: "camas", values: { sides: "ambos", foot: "liso" } })).parts;
  const fronts = ambos.filter((p) => p.kind === "drawer-front");
  assert.equal(fronts.length, 4);
  const xs = fronts.map((p) => p.position[0]);
  assert.ok(Math.min(...xs) < 50 && Math.max(...xs) > 1000, "hay cajones a la izquierda y a la derecha");
  const trampilla = buildFurniture(normalizeFurniture({ family: "camas", values: { lid: true } })).parts;
  const tapas = trampilla.filter((p) => p.hinge === "lid");
  assert.ok(tapas.length >= 1 && tapas.every((p) => p.kind === "door"));
  assert.match(tapas[0].cut?.note ?? "", /pistones/);
  const puertas = buildFurniture(normalizeFurniture({ family: "camas", values: { head: "biblioteca", headDoors: true } })).parts;
  assert.ok(puertas.some((p) => p.id.startsWith("head:door")));
});

test("el sillón de cuero cuesta más que el de tela, y la portada arma un sillón válido", async () => {
  const { HERO_SOFA } = await import("./presets.ts");
  const hero = normalizeFurniture(HERO_SOFA);
  assert.deepEqual(hero, HERO_SOFA, "la portada usa valores que la familia admite");
  const tela = furniturePrice({ ...hero, fabric: "arena" });
  const cuero = furniturePrice({ ...hero, fabric: "suela" });
  assert.ok(cuero > tela, `cuero ${cuero} no supera a tela ${tela}`);
  assert.ok(buildFurniture(hero).parts.length > 0);
});

test("la mesa de luz con esquinas curvas lleva sus curvas y su frente redondeado en el despiece", () => {
  const config = normalizeFurniture({ ...defaultFurniture("ratonas"), values: { ...defaultFurniture("ratonas").values, kind: "luz", style: "curva", width: 500, depth: 400, height: 520, drawers: 1 } });
  const parts = buildFurniture(config).assembly.runs.flatMap((r) => r.parts);
  const bends = parts.filter((p) => p.geometry === "bend");
  assert.equal(bends.length, 2);
  for (const b of bends) {
    assert.match(b.cut?.note ?? "", /MDF flexible/);
    // la curva cubre de la tapa al lateral: la caja es un cuadrado del radio
    assert.equal(b.size[0], b.size[1]);
  }
  const front = parts.find((p) => p.kind === "drawer-front")!;
  assert.ok(front.corners && front.corners[0] > 0);
  assert.match(front.cut?.note ?? "", /redondeadas/);
});

test("en el sillón recto la estructura es una sola y solo se separan los almohadones; las burbujas, de corrido", () => {
  const recto = buildFurniture(normalizeFurniture({ family: "sillones", values: { style: "recto", seats: 3, arms: true } })).parts;
  assert.equal(recto.filter((p) => p.label === "Base").length, 1);
  assert.equal(recto.filter((p) => p.label === "Respaldo").length, 1);
  assert.equal(recto.filter((p) => p.label === "Almohadón de asiento").length, 3);
  const burbujas = buildFurniture(normalizeFurniture({ family: "sillones", values: { style: "burbujas", seats: 3 } })).parts;
  assert.equal(burbujas.filter((p) => p.id === "seat" || p.id === "back").length, 2);
  assert.ok(!burbujas.some((p) => /^(seat|back):\d/.test(p.id)), "las burbujas no van por cuerpo");
});

test("cada módulo se cambia solo, y cambiar todo el mueble olvida lo de cada módulo", async () => {
  const { moduleValues, withGlobal, withModule } = await import("./furniture.ts");
  const tv = defaultFurniture("tv");
  const uno = withModule(tv, 1, "kind", "vidrio");
  const kinds = (c: FurnitureConfig) => buildFurniture(c).parts.filter((p) => p.material === "glass").length;
  assert.equal(kinds(tv), 0);
  assert.ok(kinds(uno) > 0, "el módulo 2 pasa a vidrio");
  assert.equal(moduleValues(uno, 1).kind, "vidrio");
  assert.equal(moduleValues(uno, 0).kind, "nicho-cajon");
  // un enlace editado a mano no mete cualquier cosa
  const raro = normalizeFurniture({ ...tv, modules: { "1": { kind: "toString", drawers: 99 }, x: { kind: "vidrio" } } });
  assert.deepEqual(raro.modules, { "1": { drawers: 3 } });
  // cambiar los frentes de todo el mueble olvida el vidrio del módulo 2
  const todos = withGlobal(uno, "fronts", "puertas");
  assert.equal(todos.modules, undefined);
  // la biblioteca: una columna con vidrio y más estantes
  const bib = withModule(withModule(defaultFurniture("bibliotecas"), 0, "doors", "vidrio"), 0, "shelves", 6);
  const parts = buildFurniture(bib).parts;
  assert.ok(parts.some((p) => p.id.startsWith("door:0") && p.material === "glass"));
  assert.ok(!parts.some((p) => p.id.startsWith("door:1") && p.material === "glass"));
});
