import assert from "node:assert/strict";
import { test } from "node:test";

import { parseConsent, makeConsent, CONSENT_VERSION } from "./consent.ts";
import {
  EMPTY_STATE,
  LIMITS,
  cartOf,
  cartTotal,
  duplicateDesign,
  favoritesOf,
  mergeStates,
  patchDesign,
  removeDesign,
  sanitizeDesign,
  sanitizeState,
  shortCode,
  upsertDesign,
  type SavedDesign,
} from "./designs.ts";
import { inquiryMessage } from "./inquiry.ts";

const design = (id: string, extra: Partial<SavedDesign> = {}): SavedDesign => ({
  id: `${id}-0000-0000`,
  type: "placares",
  name: `Placard ${id}`,
  config: { height: 2400 },
  summary: { dimensions: "240 × 240 × 60 cm", lines: ["Recto · 3 módulos"] },
  price: 1_000_000,
  preview: null,
  favorite: true,
  cart: false,
  createdAt: 1000,
  updatedAt: 1000,
  ...extra,
});

test("guardar, editar y borrar un diseño", () => {
  let state = upsertDesign(EMPTY_STATE, design("a"));
  state = upsertDesign(state, design("b", { updatedAt: 2000 }));
  assert.deepEqual(state.designs.map((d) => d.id), ["b-0000-0000", "a-0000-0000"], "los modificados hace menos van primero");

  state = patchDesign(state, "a-0000-0000", { name: "Vestidor", cart: true }, 3000);
  const a = state.designs.find((d) => d.id === "a-0000-0000")!;
  assert.equal(a.name, "Vestidor");
  assert.equal(a.createdAt, 1000, "editar no cambia la fecha de creación");
  assert.equal(a.updatedAt, 3000);
  assert.equal(state.designs[0].id, "a-0000-0000");

  state = removeDesign(state, "b-0000-0000", 4000);
  assert.equal(state.designs.length, 1);
  assert.deepEqual(state.tombstones, [{ id: "b-0000-0000", deletedAt: 4000 }]);
  assert.equal(removeDesign(state, "no-existe-0000", 5000), state, "borrar algo que no está no cambia nada");
});

test("duplicar copia todo con otro identificador y otro nombre", () => {
  let state = upsertDesign(EMPTY_STATE, design("a", { cart: true }));
  state = duplicateDesign(state, "a-0000-0000", "copia-0000-0001", 2000);
  state = duplicateDesign(state, "a-0000-0000", "copia-0000-0002", 3000);
  const names = state.designs.map((d) => d.name).sort();
  assert.deepEqual(names, ["Placard a", "Placard a (copia 2)", "Placard a (copia)"]);
  const copy = state.designs.find((d) => d.id === "copia-0000-0001")!;
  assert.deepEqual(copy.config, { height: 2400 });
  assert.ok(copy.cart && copy.favorite);
  assert.equal(copy.createdAt, 2000);
});

test("favoritos y carrito son independientes, y el total suma solo el carrito", () => {
  let state = upsertDesign(EMPTY_STATE, design("a", { favorite: true, cart: true, price: 100 }));
  state = upsertDesign(state, design("b", { favorite: false, cart: true, price: 250 }));
  state = upsertDesign(state, design("c", { favorite: true, cart: false, price: 999 }));
  assert.equal(favoritesOf(state).length, 2);
  assert.equal(cartOf(state).length, 2);
  assert.equal(cartTotal(state), 350);
  assert.equal(cartTotal(upsertDesign(EMPTY_STATE, design("d", { cart: true, price: null }))), null);
});

test("al pasar el tope salen los más viejos, nunca el que se acaba de guardar", () => {
  let state = EMPTY_STATE;
  for (let i = 0; i < LIMITS.designs + 5; i++) state = upsertDesign(state, design(`d${String(i).padStart(4, "0")}`, { updatedAt: 1000 + i }));
  assert.equal(state.designs.length, LIMITS.designs);
  assert.equal(state.designs[0].id, `d${String(LIMITS.designs + 4).padStart(4, "0")}-0000-0000`);
  assert.ok(!state.designs.some((d) => d.id === "d0000-0000-0000"));
});

test("fusión entre dispositivos: gana lo último, y un borrado posterior gana", () => {
  const local = { designs: [design("a", { name: "local", updatedAt: 5000 }), design("b", { updatedAt: 1000 })], tombstones: [{ id: "c-0000-0000", deletedAt: 9000 }] };
  const remote = {
    designs: [design("a", { name: "remoto", updatedAt: 3000 }), design("c", { updatedAt: 8000 }), design("d", { updatedAt: 2000 })],
    tombstones: [{ id: "b-0000-0000", deletedAt: 500 }],
  };
  const merged = mergeStates(local, remote);
  const byId = Object.fromEntries(merged.designs.map((d) => [d.id, d]));
  assert.equal(byId["a-0000-0000"].name, "local", "gana la versión modificada más tarde");
  assert.ok(byId["b-0000-0000"], "se editó después del borrado: sigue vivo");
  assert.ok(!byId["c-0000-0000"], "se borró después de la última edición");
  assert.ok(byId["d-0000-0000"], "lo nuevo del otro dispositivo aparece");
  assert.deepEqual(merged.tombstones, [{ id: "c-0000-0000", deletedAt: 9000 }]);
  // juntar dos veces da lo mismo: se puede sincronizar las veces que haga falta
  assert.deepEqual(mergeStates(merged, remote), merged);
});

test("lo que viene de afuera se valida y nunca rompe", () => {
  assert.equal(sanitizeDesign(null), null);
  assert.equal(sanitizeDesign({ ...design("a"), id: "../../etc" }), null);
  assert.equal(sanitizeDesign({ ...design("a"), config: "texto" }), null);
  assert.equal(sanitizeDesign({ ...design("a"), config: { x: "y".repeat(LIMITS.config) } }), null, "una configuración enorme se descarta");
  assert.equal(sanitizeDesign({ ...design("a"), updatedAt: "ayer" }), null);

  const cleaned = sanitizeDesign({ ...design("a"), name: `  ${"n".repeat(200)}  `, preview: "javascript:alert(1)", price: -5, favorite: "sí", summary: { dimensions: 5, lines: ["ok", 3, null] } })!;
  assert.equal(cleaned.name.length, LIMITS.name);
  assert.equal(cleaned.preview, null, "solo se acepta una imagen como vista previa");
  assert.equal(cleaned.price, null);
  assert.equal(cleaned.favorite, false);
  assert.deepEqual(cleaned.summary, { dimensions: "", lines: ["ok"] });

  const state = sanitizeState({ designs: [design("a"), "basura", design("a", { updatedAt: 9000, name: "nuevo" })], tombstones: [{ id: "x" }, { id: "b-0000-0000", deletedAt: 5 }] });
  assert.equal(state.designs.length, 1);
  assert.equal(state.designs[0].name, "nuevo");
  assert.deepEqual(state.tombstones, [{ id: "b-0000-0000", deletedAt: 5 }]);
  assert.deepEqual(sanitizeState("nada"), EMPTY_STATE);
});

test("el código corto de un diseño es estable y legible", () => {
  assert.equal(shortCode("7f3a2c10-1111-4222-8333-444455556666"), "MD-7F3A2C");
});

test("la consulta conjunta lista cada mueble con sus datos y el total", () => {
  const items = [design("a", { name: "Placard del dormitorio", price: 2_000_000 }), design("b", { name: "Placard del pasillo", price: 500_000 })];
  const text = inquiryMessage(items, (d) => `https://ejemplo.com/demo/?c=${d.id}`);
  assert.match(text, /armé estos 2 muebles a medida y quiero pedir una cotización/);
  assert.match(text, /1\. Placard del dormitorio \(MD-A00000\)/);
  assert.match(text, /2\. Placard del pasillo/);
  assert.match(text, /240 × 240 × 60 cm/);
  assert.match(text, /Diseño: https:\/\/ejemplo\.com\/demo\/\?c=a-0000-0000/);
  assert.match(text, /Total estimado: \$\s?2\.500\.000/);
  assert.match(text, /Los precios son estimados/);

  const one = inquiryMessage([items[0]], () => null, "Carpintería Sur");
  assert.match(one, /^Hola Carpintería Sur, armé este mueble a medida/);
  assert.ok(!one.includes("Total estimado") && !one.includes("Diseño:"));
});

test("consentimiento: se lee solo si es de la versión vigente y conserva su identificador", () => {
  assert.equal(parseConsent(null), null);
  assert.equal(parseConsent("{mal"), null);
  assert.equal(parseConsent(JSON.stringify({ id: "x", version: "vieja", at: 1, analytics: true, marketing: true })), null, "una versión anterior vuelve a preguntar");
  const first = makeConsent({ analytics: false, marketing: false }, null, 100, () => "id-nuevo");
  assert.deepEqual(first, { id: "id-nuevo", version: CONSENT_VERSION, at: 100, analytics: false, marketing: false });
  const changed = makeConsent({ analytics: true, marketing: false }, first, 200, () => "otro");
  assert.equal(changed.id, "id-nuevo", "cambiar de opinión no crea otro registro");
  assert.equal(changed.at, 200);
  assert.deepEqual(parseConsent(JSON.stringify(changed)), changed);
  assert.equal(parseConsent(JSON.stringify({ ...changed, analytics: "true" }))!.analytics, false, "lo opcional solo vale si es un sí explícito");
});
