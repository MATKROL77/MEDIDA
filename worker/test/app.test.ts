/**
 * Pruebas de la API con una base SQLite en memoria. Ejercitan la misma función
 * que corre en Cloudflare, con un reloj que se puede adelantar y con el envío
 * de emails y notificaciones reemplazado por listas donde queda lo que se
 * hubiera mandado.
 */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

import { handle } from "../core/app.ts";
import { LOGIN_TTL } from "../core/auth.ts";
import { pushRequest, validEndpoint, vapidKeys, verifyPushRequest } from "../core/push.ts";
import { arm, processDue, purge } from "../core/reminders.ts";
import { PLATFORM_SCHEMA, TENANT_SCHEMA } from "../core/schema.ts";
import { migrate, type Sql, type Value } from "../core/sql.ts";
import { tenantStore, type TenantApi } from "../core/tenant.ts";
import { DAY, HOUR, MINUTE, type Deps, type Mail } from "../core/types.ts";

const ORIGIN = "https://medida.test";
const ADMIN = "admin@medida.test";

function memory(schema: string[]): Sql {
  const db = new DatabaseSync(":memory:");
  const sql: Sql = {
    all: (query: string, ...params: Value[]) => db.prepare(query).all(...params) as never,
    run: (query: string, ...params: Value[]) => {
      db.prepare(query).run(...params);
    },
  };
  migrate(sql, schema);
  return sql;
}

type Reply = { status: number; data: Record<string, any>; cookie: string | null };

function server(options: { email?: boolean; push?: "ok" | "gone" | "error" } = {}) {
  let now = Date.UTC(2026, 10, 12, 12);
  const mails: Mail[] = [];
  const pushes: string[] = [];
  const alarms: number[] = [];
  const tenants = new Map<string, TenantApi>();
  const deps: Deps = {
    sql: memory(PLATFORM_SCHEMA),
    now: () => now,
    config: { adminEmails: [ADMIN], emailEnabled: options.email ?? true, devOutbox: false },
    sendEmail: async (mail) => {
      mails.push(mail);
      return true;
    },
    sendPush: async (endpoint) => {
      pushes.push(endpoint);
      return options.push ?? "ok";
    },
    schedule: async (at) => {
      alarms.push(at);
    },
    // cada empresa, su propia base: igual que en Cloudflare
    tenant: (id) => {
      if (!tenants.has(id)) tenants.set(id, tenantStore(memory(TENANT_SCHEMA), () => now));
      return tenants.get(id)!;
    },
  };

  async function call(method: string, path: string, body?: unknown, cookie?: string | null, headers: Record<string, string> = {}): Promise<Reply> {
    const res = await handle(
      new Request(ORIGIN + path, {
        method,
        headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}), origin: ORIGIN, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      deps,
    );
    const set = res.headers.get("set-cookie");
    return { status: res.status, data: (await res.json()) as Record<string, any>, cookie: set ? set.split(";")[0] : null };
  }

  /** entra con un email, como lo haría una persona: pide el enlace y lo abre */
  async function login(email: string): Promise<string> {
    const before = mails.length;
    assert.equal((await call("POST", "/api/auth/start", { email })).status, 200);
    const token = /#t=([\w-]+)/.exec(mails[before].text)![1];
    const verified = await call("POST", "/api/auth/verify", { token });
    assert.equal(verified.status, 200);
    return verified.cookie!;
  }

  return { deps, call, login, mails, pushes, alarms, advance: (ms: number) => (now += ms), now: () => now };
}

const design = (id: string, extra: Record<string, unknown> = {}) => ({
  id: `${id}00000-0000-4000-8000-000000000000`.slice(0, 36),
  type: "placares",
  name: `Placard ${id}`,
  config: { height: 2400 },
  summary: { dimensions: "240 × 240 × 60 cm", lines: ["Recto · 3 módulos"] },
  price: 2_171_000,
  preview: "data:image/jpeg;base64,AAAA",
  favorite: true,
  cart: false,
  createdAt: Date.UTC(2026, 10, 12, 10),
  updatedAt: Date.UTC(2026, 10, 12, 11),
  ...extra,
});

// ------------------------------------------------------------------ acceso

test("entrar con el enlace: llega un email, abre sesión y sirve una sola vez", async () => {
  const s = server();
  assert.equal((await s.call("GET", "/api/me")).status, 401);

  assert.equal((await s.call("POST", "/api/auth/start", { email: "  Ana@Ejemplo.com " })).status, 200);
  assert.equal(s.mails.length, 1);
  assert.equal(s.mails[0].to, "ana@ejemplo.com");
  assert.equal(s.mails[0].subject, "Tu acceso a MEDIDA");
  const link = /https:\/\/medida\.test\/cuenta\/verificar\/#t=([\w-]+)/.exec(s.mails[0].text);
  assert.ok(link, "el email trae el enlace");
  // el valor del enlace va después del #: el navegador no lo manda a ningún servidor al abrirlo
  assert.ok(!s.mails[0].text.includes("?t="));

  const verified = await s.call("POST", "/api/auth/verify", { token: link[1] });
  assert.equal(verified.status, 200);
  assert.equal(verified.data.user.email, "ana@ejemplo.com");
  assert.equal(verified.data.created, true);
  assert.match(verified.cookie!, /^medida_s=[\w-]{40,}$/);

  const me = await s.call("GET", "/api/me", undefined, verified.cookie);
  assert.deepEqual(me.data.user, { email: "ana@ejemplo.com", isAdmin: false, prefs: { remindersEmail: false, remindersPush: false, marketing: false }, tenants: [] });

  assert.equal((await s.call("POST", "/api/auth/verify", { token: link[1] })).status, 401, "el enlace no se puede usar dos veces");
});

test("la sesión viaja en una cookie que los scripts no pueden leer", async () => {
  const s = server();
  await s.call("POST", "/api/auth/start", { email: "ana@ejemplo.com" });
  const token = /#t=([\w-]+)/.exec(s.mails[0].text)![1];
  const res = await handle(new Request(`${ORIGIN}/api/auth/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }), s.deps);
  const cookie = res.headers.get("set-cookie")!;
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) assert.ok(cookie.includes(flag), `falta ${flag}`);
  // en la base queda la huella, no el valor: con lo guardado no se puede entrar
  const stored = s.deps.sql.all<{ hash: string }>("SELECT hash FROM sessions");
  assert.ok(!cookie.includes(stored[0].hash));
  assert.equal(s.deps.sql.all("SELECT * FROM login_tokens WHERE hash = ?", token).length, 0);
});

test("entrar con el código: seis dígitos, con pocos intentos", async () => {
  const s = server();
  await s.call("POST", "/api/auth/start", { email: "ana@ejemplo.com" });
  const code = /código en la página: (\d{6})/.exec(s.mails[0].text)![1];

  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) assert.equal((await s.call("POST", "/api/auth/verify", { email: "ana@ejemplo.com", code: wrong })).status, 401);
  assert.equal((await s.call("POST", "/api/auth/verify", { email: "ana@ejemplo.com", code })).status, 401, "después de cinco errores el código queda anulado");

  await s.call("POST", "/api/auth/start", { email: "ana@ejemplo.com" });
  const fresh = /código en la página: (\d{6})/.exec(s.mails[1].text)![1];
  assert.equal((await s.call("POST", "/api/auth/verify", { email: "otra@ejemplo.com", code: fresh })).status, 401, "el código es de esa casilla");
  const ok = await s.call("POST", "/api/auth/verify", { email: "ANA@ejemplo.com", code: fresh });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.email, "ana@ejemplo.com");
});

test("el enlace vence a los 15 minutos", async () => {
  const s = server();
  await s.call("POST", "/api/auth/start", { email: "ana@ejemplo.com" });
  const token = /#t=([\w-]+)/.exec(s.mails[0].text)![1];
  s.advance(LOGIN_TTL + 1000);
  assert.equal((await s.call("POST", "/api/auth/verify", { token })).status, 401);
});

test("no se puede usar el acceso para llenarle la casilla a alguien", async () => {
  const s = server();
  for (let i = 0; i < 4; i++) assert.equal((await s.call("POST", "/api/auth/start", { email: "ana@ejemplo.com" })).status, 200);
  assert.equal((await s.call("POST", "/api/auth/start", { email: "ana@ejemplo.com" })).status, 429);
  assert.equal(s.mails.length, 4);
  s.advance(16 * MINUTE);
  assert.equal((await s.call("POST", "/api/auth/start", { email: "ana@ejemplo.com" })).status, 200);
});

test("sin proveedor de email el acceso avisa que no está disponible, no simula", async () => {
  const s = server({ email: false });
  const res = await s.call("POST", "/api/auth/start", { email: "ana@ejemplo.com" });
  assert.equal(res.status, 503);
  assert.equal(res.data.error, "email_no_disponible");
  assert.equal(s.mails.length, 0);
  assert.equal((await s.call("GET", "/api/public/site")).data.features.email, false);
});

test("emails mal escritos y pedidos de otro sitio se rechazan", async () => {
  const s = server();
  for (const email of ["", "ana", "ana@", "a b@c.com", 5]) assert.equal((await s.call("POST", "/api/auth/start", { email })).status, 400);
  const cross = await s.call("POST", "/api/auth/start", { email: "ana@ejemplo.com" }, null, { origin: "https://otro-sitio.test" });
  assert.equal(cross.status, 403);
  assert.equal(s.mails.length, 0);
});

test("las novedades comerciales se aceptan aparte de la cuenta", async () => {
  const s = server();
  const plain = await s.login("ana@ejemplo.com");
  assert.equal((await s.call("GET", "/api/me", undefined, plain)).data.user.prefs.marketing, false, "crear la cuenta no suma a ninguna lista");

  await s.call("POST", "/api/auth/start", { email: "beto@ejemplo.com", marketing: true });
  const token = /#t=([\w-]+)/.exec(s.mails.at(-1)!.text)![1];
  const beto = await s.call("POST", "/api/auth/verify", { token });
  assert.equal(beto.data.user.prefs.marketing, true);
  const off = await s.call("PATCH", "/api/me", { marketing: false }, beto.cookie);
  assert.equal(off.data.user.prefs.marketing, false, "se puede retirar cuando quiera");
});

test("cerrar sesión y eliminar la cuenta", async () => {
  const s = server();
  const cookie = await s.login("ana@ejemplo.com");
  await s.call("POST", "/api/designs/sync", { upserts: [design("a")] }, cookie);
  assert.equal((await s.call("POST", "/api/auth/logout", {}, cookie)).status, 200);
  assert.equal((await s.call("GET", "/api/me", undefined, cookie)).status, 401);

  const again = await s.login("ana@ejemplo.com");
  assert.equal((await s.call("GET", "/api/designs", undefined, again)).data.designs.length, 1, "los diseños siguen en la cuenta");
  assert.equal((await s.call("DELETE", "/api/me", undefined, again)).status, 200);
  assert.equal((await s.call("GET", "/api/me", undefined, again)).status, 401);
  for (const table of ["users", "sessions", "designs", "reminders", "login_tokens"]) assert.equal(s.deps.sql.all(`SELECT * FROM ${table}`).length, 0, `quedó algo en ${table}`);
});

// ------------------------------------------------------------------ diseños

test("los diseños se sincronizan entre dispositivos y gana lo último", async () => {
  const s = server();
  const phone = await s.login("ana@ejemplo.com");
  const first = await s.call("POST", "/api/designs/sync", { upserts: [design("a"), design("b")] }, phone);
  assert.equal(first.data.designs.length, 2);

  // otra sesión de la misma persona: la computadora
  const laptop = await s.login("ana@ejemplo.com");
  const seen = await s.call("GET", "/api/designs", undefined, laptop);
  assert.equal(seen.data.designs.length, 2);
  const a = seen.data.designs.find((d: any) => d.name === "Placard a");
  assert.deepEqual(a.config, { height: 2400 });
  assert.equal(a.summary.dimensions, "240 × 240 × 60 cm");
  assert.equal(a.price, 2_171_000);
  assert.equal(a.preview, "data:image/jpeg;base64,AAAA");
  assert.equal(a.favorite, true);

  // la computadora edita; el teléfono manda una versión más vieja y pierde
  s.advance(HOUR);
  await s.call("POST", "/api/designs/sync", { upserts: [design("a", { name: "Vestidor", updatedAt: s.now() - 1000 })] }, laptop);
  const stale = await s.call("POST", "/api/designs/sync", { upserts: [design("a", { name: "viejo", updatedAt: Date.UTC(2026, 10, 12, 11, 30) })] }, phone);
  assert.equal(stale.data.designs.find((d: any) => d.id === design("a").id).name, "Vestidor");

  // borrar en un dispositivo lo saca del otro
  const removed = await s.call("POST", "/api/designs/sync", { deletes: [{ id: design("b").id, deletedAt: s.now() }] }, phone);
  assert.equal(removed.data.designs.length, 1);
  const other = await s.call("GET", "/api/designs", undefined, laptop);
  assert.deepEqual(other.data.tombstones.map((t: any) => t.id), [design("b").id]);
});

test("cada cuenta ve solo sus diseños", async () => {
  const s = server();
  const ana = await s.login("ana@ejemplo.com");
  const beto = await s.login("beto@ejemplo.com");
  await s.call("POST", "/api/designs/sync", { upserts: [design("a")] }, ana);
  assert.equal((await s.call("GET", "/api/designs", undefined, beto)).data.designs.length, 0);
  // con el mismo identificador, Beto no pisa ni borra el de Ana
  await s.call("POST", "/api/designs/sync", { upserts: [design("a", { name: "de beto", updatedAt: s.now() })], deletes: [] }, beto);
  await s.call("POST", "/api/designs/sync", { deletes: [{ id: design("a").id, deletedAt: s.now() }] }, beto);
  const mine = await s.call("GET", "/api/designs", undefined, ana);
  assert.equal(mine.data.designs.length, 1);
  assert.equal(mine.data.designs[0].name, "Placard a");
  assert.equal((await s.call("GET", "/api/designs")).status, 401);
});

test("lo que no es un diseño válido no entra", async () => {
  const s = server();
  const cookie = await s.login("ana@ejemplo.com");
  const res = await s.call(
    "POST",
    "/api/designs/sync",
    { upserts: ["basura", { id: "x" }, design("a", { preview: "<script>" }), design("b", { config: { blob: "x".repeat(40_000) } }), design("c", { updatedAt: s.now() + 10 * DAY })] },
    cookie,
  );
  const names = res.data.designs.map((d: any) => d.name).sort();
  assert.deepEqual(names, ["Placard a", "Placard c"]);
  assert.equal(res.data.designs.find((d: any) => d.name === "Placard a").preview, null);
  assert.ok(res.data.designs.find((d: any) => d.name === "Placard c").updatedAt <= s.now(), "una fecha del futuro se acota");
});

// ------------------------------------------------------------------ recordatorios

test("recordatorios: solo si se activan, al día y a los tres días, y nada más", async () => {
  const s = server();
  const cookie = await s.login("ana@ejemplo.com");
  await s.call("POST", "/api/designs/sync", { upserts: [design("a", { name: "Placard del dormitorio" }), design("b")] }, cookie);
  const before = s.mails.length;

  // sin haberlos activado, no llega nada aunque pase una semana
  s.advance(7 * DAY);
  assert.equal(await processDue(s.deps), 0);
  assert.equal(s.mails.length, before);

  await s.call("PATCH", "/api/me", { remindersEmail: true }, cookie);
  const start = s.now();
  assert.equal(s.alarms.at(-1), start + 24 * HOUR, "el servidor se despierta cuando toca el primero");

  s.advance(23 * HOUR);
  assert.equal(await processDue(s.deps), 0, "antes de las 24 horas no");
  s.advance(HOUR);
  assert.equal(await processDue(s.deps), 1);
  const first = s.mails.at(-1)!;
  assert.equal(first.to, "ana@ejemplo.com");
  assert.equal(first.subject, "Tu diseño sigue guardado en MEDIDA");
  assert.match(first.text, /Placard del dormitorio|Placard b/);
  assert.match(first.text, /Tenés 1 diseño más guardados/);
  assert.match(first.text, /Para dejar de recibir recordatorios: https:\/\/medida\.test\/cuenta\//);
  assert.equal(await processDue(s.deps), 0, "el mismo recordatorio no se repite");

  s.advance(2 * DAY);
  assert.equal(await processDue(s.deps), 1);
  assert.match(s.mails.at(-1)!.subject, /^Podés continuar personalizando tu placard$/);

  s.advance(30 * DAY);
  assert.equal(await processDue(s.deps), 0, "después del segundo no llegan más");
  assert.equal(s.mails.length, before + 2);
});

test("recordatorios: el enlace vuelve al diseño, sirve una vez y no lleva datos personales", async () => {
  const s = server();
  const cookie = await s.login("ana@ejemplo.com");
  await s.call("PATCH", "/api/me", { remindersEmail: true }, cookie);
  await s.call("POST", "/api/designs/sync", { upserts: [design("a")] }, cookie);
  s.advance(24 * HOUR);
  await processDue(s.deps);
  const link = /https:\/\/medida\.test\/cuenta\/verificar\/#t=([\w-]+)/.exec(s.mails.at(-1)!.text)!;
  assert.ok(!link[0].includes("ana") && !link[0].includes("@"), "el enlace no lleva el email");

  const back = await s.call("POST", "/api/auth/verify", { token: link[1] });
  assert.equal(back.status, 200);
  assert.equal(back.data.designId, design("a").id);
  assert.equal(back.data.user.email, "ana@ejemplo.com");
  assert.equal((await s.call("POST", "/api/auth/verify", { token: link[1] })).status, 401);

  // a los siete días ya no sirve
  await s.call("POST", "/api/designs/sync", { upserts: [design("a", { updatedAt: s.now() })] }, cookie);
  s.advance(24 * HOUR);
  await processDue(s.deps);
  const later = /#t=([\w-]+)/.exec(s.mails.at(-1)!.text)![1];
  s.advance(7 * DAY + MINUTE);
  assert.equal((await s.call("POST", "/api/auth/verify", { token: later })).status, 401);
});

test("recordatorios: se cancelan si la persona vuelve a editar, borra todo o los desactiva", async () => {
  const s = server();
  const cookie = await s.login("ana@ejemplo.com");
  await s.call("PATCH", "/api/me", { remindersEmail: true }, cookie);
  await s.call("POST", "/api/designs/sync", { upserts: [design("a")] }, cookie);
  const count = s.mails.length;

  // vuelve a editar a las 20 horas: la cuenta arranca de nuevo
  s.advance(20 * HOUR);
  await s.call("POST", "/api/designs/sync", { upserts: [design("a", { name: "editado", updatedAt: s.now() })] }, cookie);
  s.advance(5 * HOUR);
  assert.equal(await processDue(s.deps), 0, "a las 25 horas del primer guardado ya no corresponde");
  s.advance(19 * HOUR);
  assert.equal(await processDue(s.deps), 1, "sí a las 24 horas de la última edición");

  // sincronizar sin cambios no reinicia nada
  const pending = s.deps.sql.all<{ due_at: number }>("SELECT due_at FROM reminders WHERE sent_at IS NULL");
  await s.call("POST", "/api/designs/sync", { upserts: [design("a", { name: "editado", updatedAt: s.now() - 2 * DAY })] }, cookie);
  assert.deepEqual(s.deps.sql.all("SELECT due_at FROM reminders WHERE sent_at IS NULL"), pending);

  // desactivarlos cancela el que faltaba
  await s.call("PATCH", "/api/me", { remindersEmail: false }, cookie);
  assert.equal(s.deps.sql.all("SELECT * FROM reminders").length, 0);
  s.advance(10 * DAY);
  assert.equal(await processDue(s.deps), 0);

  // con recordatorios activos, borrar el último diseño también cancela
  await s.call("PATCH", "/api/me", { remindersEmail: true }, cookie);
  assert.equal(s.deps.sql.all("SELECT * FROM reminders").length, 2);
  await s.call("POST", "/api/designs/sync", { deletes: [{ id: design("a").id, deletedAt: s.now() }] }, cookie);
  assert.equal(s.deps.sql.all("SELECT * FROM reminders").length, 0);
  assert.equal(s.mails.length, count + 1);
});

test("notificaciones del navegador: suscripción validada, aviso sin contenido y baja automática", async () => {
  const s = server({ push: "gone" });
  const cookie = await s.login("ana@ejemplo.com");
  const key = await s.call("GET", "/api/push/key", undefined, cookie);
  assert.match(key.data.key, /^[\w-]{87}$/, "clave pública P-256 sin comprimir");
  assert.equal((await s.call("GET", "/api/push/key", undefined, cookie)).data.key, key.data.key, "la clave es estable");

  // solo servicios de notificaciones de navegadores: el servidor no le escribe a cualquier dirección
  for (const bad of ["http://fcm.googleapis.com/x", "https://evil.test/x", "https://fcm.googleapis.com.evil.test/x", "https://127.0.0.1/x", 7]) {
    assert.equal((await s.call("POST", "/api/push/subscribe", { endpoint: bad }, cookie)).status, 400, String(bad));
  }
  const endpoint = "https://fcm.googleapis.com/fcm/send/abc123";
  assert.equal((await s.call("POST", "/api/push/subscribe", { endpoint }, cookie)).status, 200);
  assert.equal((await s.call("POST", "/api/push/subscribe", { endpoint: "https://fcm.googleapis.com/x" })).status, 401);

  await s.call("PATCH", "/api/me", { remindersPush: true }, cookie);
  await s.call("POST", "/api/designs/sync", { upserts: [design("a", { name: "Placard del dormitorio" })] }, cookie);
  s.advance(24 * HOUR);
  await processDue(s.deps);
  assert.deepEqual(s.pushes, [endpoint]);
  assert.equal(s.mails.filter((m) => m.subject.includes("sigue guardado")).length, 0, "sin haber activado el email, no hay email");

  // el texto lo pide el navegador con la sesión: no viaja por el servicio de notificaciones
  const notice = await s.call("GET", "/api/push/notice", undefined, cookie);
  assert.equal(notice.data.notice.title, "Tu diseño sigue guardado en MEDIDA");
  assert.equal(notice.data.notice.url, `/mis-disenos/?abrir=${design("a").id}`);
  assert.equal((await s.call("GET", "/api/push/notice")).data.notice, null, "sin sesión no se muestra nada de nadie");

  // el navegador dijo que esa suscripción ya no existe: se da de baja sola
  assert.equal(s.deps.sql.all("SELECT * FROM push_subs").length, 0);
});

test("el pedido de notificación va firmado con la clave que se publica", async () => {
  const s = server();
  const keys = await vapidKeys(s.deps.sql);
  const req = await pushRequest("https://updates.push.services.mozilla.com/wpush/v2/abc", keys, "hola@medida.test", s.now());
  assert.equal(req.headers["content-length"], "0", "el aviso no lleva contenido");
  assert.ok(await verifyPushRequest(req.headers));
  const claims = JSON.parse(Buffer.from(req.headers.authorization.split("t=")[1].split(".")[1], "base64url").toString());
  assert.equal(claims.aud, "https://updates.push.services.mozilla.com");
  assert.equal(claims.sub, "mailto:hola@medida.test");
  assert.ok(claims.exp > s.now() / 1000 && claims.exp <= s.now() / 1000 + 24 * 3600);
  const tampered = { ...req.headers, authorization: req.headers.authorization.replace(/t=([\w-]+)\./, "t=$1x.") };
  assert.equal(await verifyPushRequest(tampered), false);
  assert.ok(validEndpoint("https://web.push.apple.com/abc") && validEndpoint("https://wns2-by3p.notify.windows.com/w/?token=x"));
});

test("limpieza: lo vencido se borra y el servidor vuelve a despertarse solo", async () => {
  const s = server();
  await s.call("POST", "/api/auth/start", { email: "ana@ejemplo.com" });
  await s.call("POST", "/api/events", { type: "whatsapp_click", interest: "general", placement: "hero", path: "/" });
  s.advance(14 * 30 * DAY);
  purge(s.deps);
  assert.equal(s.deps.sql.all("SELECT * FROM login_tokens").length, 0);
  assert.equal(s.deps.sql.all("SELECT * FROM events").length, 0, "la medición dura 13 meses");
  await arm(s.deps);
  assert.equal(s.alarms.at(-1), s.now() + DAY);
});

// ------------------------------------------------------------------ medición y contacto

test("los clics de contacto se anotan sin identificar a nadie", async () => {
  const s = server();
  assert.equal((await s.call("POST", "/api/events", { type: "whatsapp_click", interest: "configurador", placement: "hero", path: "/?utm=x" })).status, 200);
  assert.equal((await s.call("POST", "/api/events", { type: "email_start", interest: "plataforma", placement: "servicios", path: "/servicios/" })).status, 200);
  for (const bad of [{ type: "mensaje_enviado", interest: "general", placement: "hero", path: "/" }, { type: "whatsapp_click", interest: "<x>", placement: "hero", path: "/" }, { type: "whatsapp_click" }]) {
    assert.equal((await s.call("POST", "/api/events", bad)).status, 400);
  }
  const rows = s.deps.sql.all<Record<string, unknown>>("SELECT * FROM events ORDER BY id");
  assert.deepEqual(Object.keys(rows[0]).sort(), ["at", "id", "interest", "path", "placement", "type"], "no se guarda nada de la persona");
  assert.equal(rows[0].path, "/", "sin los parámetros de la dirección");
  // abrir WhatsApp es un clic: no existe un evento de "mensaje enviado"
  assert.deepEqual(rows.map((r) => r.type), ["whatsapp_click", "email_start"]);
});

test("la elección sobre cookies queda registrada con su fecha y su versión", async () => {
  const s = server();
  assert.equal((await s.call("POST", "/api/consent", { id: "abcd-1234-efgh", version: "2026-11", analytics: false, marketing: false })).status, 200);
  s.advance(HOUR);
  await s.call("POST", "/api/consent", { id: "abcd-1234-efgh", version: "2026-11", analytics: true, marketing: false });
  const rows = s.deps.sql.all<{ analytics: number; version: string }>("SELECT * FROM consents ORDER BY at");
  assert.deepEqual(rows.map((r) => r.analytics), [0, 1], "queda el historial, no solo lo último");
  assert.equal((await s.call("POST", "/api/consent", { id: "x", version: "2026-11" })).status, 400);
});

test("administración: solo el dueño, y el contacto que carga es el que usa todo el sitio", async () => {
  const s = server();
  const ana = await s.login("ana@ejemplo.com");
  assert.equal((await s.call("GET", "/api/admin/overview")).status, 401);
  assert.equal((await s.call("GET", "/api/admin/overview", undefined, ana)).status, 403);
  assert.equal((await s.call("PUT", "/api/admin/contact", { whatsapp: "5491100000000", email: "x@y.com" }, ana)).status, 403);

  const admin = await s.login(ADMIN);
  assert.equal((await s.call("GET", "/api/me", undefined, admin)).data.user.isAdmin, true);
  assert.deepEqual((await s.call("GET", "/api/public/site")).data.contact, {}, "sin cargar nada, el sitio usa el contacto de partida");

  for (const bad of [{ whatsapp: "123", email: "ventas@medida.test" }, { whatsapp: "+54 9 11 5555-0000", email: "no-es-email" }, {}]) {
    assert.equal((await s.call("PUT", "/api/admin/contact", bad, admin)).status, 400, "un contacto que no sirve no se guarda");
  }
  const saved = await s.call("PUT", "/api/admin/contact", { whatsapp: "+54 9 11 5555-0000", email: "Ventas@Medida.test" }, admin);
  assert.deepEqual(saved.data.contact, { whatsapp: "5491155550000", email: "ventas@medida.test" });
  assert.deepEqual((await s.call("GET", "/api/public/site")).data.contact, { whatsapp: "5491155550000", email: "ventas@medida.test" });
});

test("administración: clics, consultas recibidas, reuniones y clientes se cuentan por separado", async () => {
  const s = server();
  const admin = await s.login(ADMIN);
  for (let i = 0; i < 3; i++) await s.call("POST", "/api/events", { type: "whatsapp_click", interest: "configurador", placement: "hero", path: "/" });
  await s.call("POST", "/api/events", { type: "email_start", interest: "web", placement: "contacto", path: "/" });

  const lead = await s.call("POST", "/api/admin/leads", { name: "Carpintería Sur", company: "Sur SRL", channel: "whatsapp", interest: "configurador", notes: "Escribió por el configurador" }, admin);
  assert.equal(lead.data.lead.stage, "consulta", "una oportunidad empieza como consulta recibida");
  await s.call("POST", "/api/admin/leads", { name: "Muebles Norte", stage: "reunion" }, admin);
  assert.equal((await s.call("POST", "/api/admin/leads", { company: "sin nombre" }, admin)).status, 400);
  const moved = await s.call("PATCH", `/api/admin/leads/${lead.data.lead.id}`, { stage: "cliente" }, admin);
  assert.equal(moved.data.lead.stage, "cliente");
  assert.equal(moved.data.lead.name, "Carpintería Sur", "cambiar la etapa no borra lo demás");
  assert.equal(moved.data.lead.notes, "Escribió por el configurador");

  const overview = (await s.call("GET", "/api/admin/overview", undefined, admin)).data;
  assert.deepEqual(overview.stats.clicks.last7, { whatsapp_click: 3, email_start: 1 });
  assert.deepEqual(overview.stats.leads, { cliente: 1, reunion: 1 });
  assert.equal(overview.leads.length, 2);
  assert.equal(overview.stats.accounts, 1);

  assert.equal((await s.call("DELETE", `/api/admin/leads/${lead.data.lead.id}`, undefined, admin)).status, 200);
  assert.equal((await s.call("GET", "/api/admin/overview", undefined, admin)).data.leads.length, 1);
});

// ------------------------------------------------------------------ empresas

async function withTenants() {
  const s = server();
  const admin = await s.login(ADMIN);
  const sur = (await s.call("POST", "/api/admin/tenants", { name: "Carpintería Sur", slug: "carpinteria-sur", plan: "Piloto", configuratorLimit: 1, members: ["Sur@Ejemplo.com"] }, admin)).data.tenant;
  const norte = (await s.call("POST", "/api/admin/tenants", { name: "Muebles Norte", slug: "muebles-norte", plan: "Piloto", configuratorLimit: 2, members: ["norte@ejemplo.com"] }, admin)).data.tenant;
  return { s, admin, sur, norte, surUser: await s.login("sur@ejemplo.com"), norteUser: await s.login("norte@ejemplo.com") };
}

test("empresas: cada una entra a lo suyo y no ve que existen las otras", async () => {
  const { s, sur, norte, surUser, norteUser, admin } = await withTenants();
  assert.deepEqual(sur.members, ["sur@ejemplo.com"]);
  assert.deepEqual((await s.call("GET", "/api/panel", undefined, surUser)).data.tenants.map((t: any) => t.slug), ["carpinteria-sur"]);
  assert.equal((await s.call("GET", `/api/panel/${norte.id}`, undefined, surUser)).status, 404, "la empresa de otro no existe para mí");
  assert.equal((await s.call("PUT", `/api/panel/${norte.id}/profile`, { whatsapp: "5491100000000" }, surUser)).status, 404);
  assert.equal((await s.call("GET", `/api/panel/${norte.id}`, undefined, norteUser)).status, 200);
  assert.equal((await s.call("GET", "/api/panel", undefined, admin)).data.tenants.length, 2, "quien administra MEDIDA ve todas");
  assert.equal((await s.call("GET", `/api/panel/${sur.id}`)).status, 401);
  assert.equal((await s.call("POST", "/api/admin/tenants", { name: "Otra", slug: "carpinteria-sur", configuratorLimit: 1 }, admin)).status, 409);
  assert.equal((await s.call("POST", "/api/admin/tenants", { name: "Otra", slug: "Mal Slug!", configuratorLimit: 1 }, admin)).status, 400);
  assert.equal((await s.call("POST", "/api/admin/tenants", { name: "Otra", slug: "otra", configuratorLimit: 1 }, surUser)).status, 403);
});

test("empresas: la cantidad de configuradores la fija el plan", async () => {
  const { s, sur, surUser, admin } = await withTenants();
  const first = await s.call("POST", `/api/panel/${sur.id}/configurators`, { family: "placares", name: "Placares Sur", params: { margin: 0.6, materials: ["blanco", "roble"], boardPrices: { roble: 150000 } } }, surUser);
  assert.equal(first.status, 200);
  assert.deepEqual(first.data.configurator.params, { margin: 0.6, materials: ["blanco", "roble"], boardPrices: { roble: 150000 } });

  const second = await s.call("POST", `/api/panel/${sur.id}/configurators`, { family: "placares", name: "Otro" }, surUser);
  assert.equal(second.status, 409);
  assert.equal(second.data.error, "limite_del_plan");

  // editar el que ya tiene no cuenta contra el tope
  const edited = await s.call("POST", `/api/panel/${sur.id}/configurators`, { id: first.data.configurator.id, name: "Placares y vestidores", params: { margin: 0.5 } }, surUser);
  assert.equal(edited.data.configurator.name, "Placares y vestidores");

  // una familia que todavía no tiene motor no se puede dar de alta
  assert.equal((await s.call("POST", `/api/panel/${sur.id}/configurators`, { family: "sillones", name: "Sillones" }, surUser)).status, 400);

  // el administrador sube el plan y ahora sí entra otro
  await s.call("PATCH", `/api/admin/tenants/${sur.id}`, { configuratorLimit: 2 }, admin);
  assert.equal((await s.call("POST", `/api/panel/${sur.id}/configurators`, { family: "placares", name: "Otro" }, surUser)).status, 200);
});

test("empresas: el configurador embebido manda la consulta a la empresa, nunca a MEDIDA", async () => {
  const { s, sur, norte, surUser, norteUser } = await withTenants();
  const made = await s.call("POST", `/api/panel/${sur.id}/configurators`, { family: "placares", name: "Placares Sur" }, surUser);
  const k = made.data.configurator.id;

  // sin un WhatsApp cargado no hay a dónde mandar la consulta: no se publica
  assert.equal((await s.call("GET", "/api/public/embed?t=carpinteria-sur")).status, 404);
  assert.equal((await s.call("PUT", `/api/panel/${sur.id}/profile`, { whatsapp: "123" }, surUser)).status, 400);
  await s.call("PUT", `/api/panel/${sur.id}/profile`, { whatsapp: "+54 9 11 4444-0000", email: "ventas@sur.test", tagline: "Placares a medida" }, surUser);

  const embed = await s.call("GET", "/api/public/embed?t=carpinteria-sur");
  assert.equal(embed.status, 200);
  assert.deepEqual(embed.data.tenant, { name: "Carpintería Sur", whatsapp: "5491144440000", email: "ventas@sur.test", tagline: "Placares a medida" });
  assert.equal(embed.data.configurator.id, k);
  assert.ok(!JSON.stringify(embed.data).includes("2324582614"), "no aparece el contacto de MEDIDA");
  assert.equal((await s.call("GET", "/api/public/embed?t=no-existe")).status, 404);

  const sent = await s.call("POST", "/api/public/inquiries", { t: "carpinteria-sur", k, channel: "whatsapp", config: { height: 2400 }, summary: { dimensions: "240 × 240 × 60 cm", lines: ["Recto"] }, price: 1_500_000 });
  assert.equal(sent.status, 200);
  assert.equal((await s.call("POST", "/api/public/inquiries", { t: "carpinteria-sur", k: "no-es-de-esta-empresa", config: {} })).status, 400);

  const panel = (await s.call("GET", `/api/panel/${sur.id}`, undefined, surUser)).data;
  assert.equal(panel.inquiries.length, 1);
  assert.equal(panel.inquiries[0].status, "nueva");
  assert.equal(panel.inquiries[0].summary.dimensions, "240 × 240 × 60 cm");
  assert.deepEqual(panel.usage, [{ configuratorId: k, opens: 1, inquiries: 1 }]);
  // la consulta de un cliente de Sur no aparece en Norte ni en la plataforma
  assert.equal((await s.call("GET", `/api/panel/${norte.id}`, undefined, norteUser)).data.inquiries.length, 0);
  assert.equal(s.deps.sql.all("SELECT * FROM leads").length, 0, "MEDIDA no se queda con la consulta como oportunidad propia");

  const id = panel.inquiries[0].id;
  assert.equal((await s.call("PATCH", `/api/panel/${sur.id}/inquiries/${id}`, { status: "cotizada" }, surUser)).status, 200);
  assert.equal((await s.call("PATCH", `/api/panel/${norte.id}/inquiries/${id}`, { status: "ganada" }, norteUser)).status, 400, "otra empresa no puede tocarla");
  assert.equal((await s.call("PATCH", `/api/panel/${sur.id}/inquiries/${id}`, { status: "pagada" }, surUser)).status, 400);
});

test("empresas: pausar la saca de línea y eliminarla borra sus datos", async () => {
  const { s, sur, surUser, admin } = await withTenants();
  const made = await s.call("POST", `/api/panel/${sur.id}/configurators`, { family: "placares", name: "Placares Sur" }, surUser);
  await s.call("PUT", `/api/panel/${sur.id}/profile`, { whatsapp: "5491144440000" }, surUser);
  await s.call("POST", "/api/public/inquiries", { t: "carpinteria-sur", k: made.data.configurator.id, config: {}, summary: {} });

  await s.call("PATCH", `/api/admin/tenants/${sur.id}`, { status: "pausada" }, admin);
  assert.equal((await s.call("GET", "/api/public/embed?t=carpinteria-sur")).status, 404);
  await s.call("PATCH", `/api/admin/tenants/${sur.id}`, { status: "activa" }, admin);
  assert.equal((await s.call("GET", "/api/public/embed?t=carpinteria-sur")).status, 200);

  assert.equal((await s.call("DELETE", `/api/admin/tenants/${sur.id}`, undefined, admin)).status, 200);
  assert.equal((await s.call("GET", `/api/panel/${sur.id}`, undefined, surUser)).status, 404);
  assert.equal((await s.deps.tenant(sur.id).inquiries()).length, 0);
  assert.equal((await s.deps.tenant(sur.id).configurators()).length, 0);
});
