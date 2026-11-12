/**
 * La API de MEDIDA. Todo lo que el sitio le pide al servidor entra por acá.
 *
 * Es una sola función, `handle`, que recibe el pedido y lo que necesita de
 * afuera (`Deps`). No sabe si corre en Cloudflare o en una prueba.
 */

import { INTERESTS, cleanWhatsapp, isValidEmail, isValidWhatsapp } from "../../src/lib/site.ts";
import { SESSION_TTL, allow, closeSession, deleteUser, isAdmin, normalizeEmail, openSession, redeem, sessionUser, startLogin, type User } from "./auth.ts";
import { sha256 } from "./crypto.ts";
import { listDesigns, syncDesigns } from "./designsync.ts";
import { fail, json, readBody, sessionCookie, str } from "./http.ts";
import { validEndpoint, vapidKeys } from "./push.ts";
import { touch } from "./reminders.ts";
import { one } from "./sql.ts";
import { DAY, HOUR, MINUTE, type Deps } from "./types.ts";

const LEAD_STAGES = ["consulta", "reunion", "cliente", "descartada"] as const;
const LEAD_CHANNELS = ["whatsapp", "email", "otro"] as const;
const EVENT_TYPES = ["whatsapp_click", "email_start"] as const;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type TenantRow = { id: string; slug: string; name: string; plan: string; configurator_limit: number; status: string; created_at: number };

const publicUser = (deps: Deps, user: User) => ({
  email: user.email,
  isAdmin: isAdmin(deps, user),
  prefs: { remindersEmail: user.reminders_email === 1, remindersPush: user.reminders_push === 1, marketing: user.marketing === 1 },
  tenants: tenantsOf(deps, user).map((t) => ({ id: t.id, slug: t.slug, name: t.name })),
});

function tenantsOf(deps: Deps, user: User): TenantRow[] {
  if (isAdmin(deps, user)) return deps.sql.all<TenantRow>("SELECT * FROM tenants ORDER BY created_at");
  return deps.sql.all<TenantRow>("SELECT t.* FROM tenants t JOIN tenant_members m ON m.tenant_id = t.id WHERE m.email = ? ORDER BY t.created_at", user.email);
}

const tenantView = (deps: Deps, t: TenantRow) => ({
  id: t.id,
  slug: t.slug,
  name: t.name,
  plan: t.plan,
  configuratorLimit: t.configurator_limit,
  status: t.status,
  createdAt: t.created_at,
  members: deps.sql.all<{ email: string }>("SELECT email FROM tenant_members WHERE tenant_id = ? ORDER BY email", t.id).map((m) => m.email),
});

function contactOverrides(deps: Deps): { whatsapp?: string; email?: string } {
  const rows = deps.sql.all<{ key: string; value: string }>("SELECT key, value FROM meta WHERE key IN ('contact_whatsapp', 'contact_email')");
  const out: { whatsapp?: string; email?: string } = {};
  for (const r of rows) {
    if (r.key === "contact_whatsapp") out.whatsapp = r.value;
    else out.email = r.value;
  }
  return out;
}

/** cuántos clics de contacto hubo, por período, por servicio y por parte del sitio */
function stats(deps: Deps) {
  const now = deps.now();
  const since = (days: number) => Object.fromEntries(deps.sql.all<{ type: string; n: number }>("SELECT type, COUNT(*) AS n FROM events WHERE at >= ? GROUP BY type", now - days * DAY).map((r) => [r.type, r.n]));
  const month = now - 30 * DAY;
  return {
    clicks: { last7: since(7), last30: since(30), last90: since(90) },
    byInterest: deps.sql.all("SELECT type, interest, COUNT(*) AS n FROM events WHERE at >= ? GROUP BY type, interest ORDER BY n DESC", month),
    byPlacement: deps.sql.all("SELECT type, placement, COUNT(*) AS n FROM events WHERE at >= ? GROUP BY type, placement ORDER BY n DESC", month),
    leads: Object.fromEntries(deps.sql.all<{ stage: string; n: number }>("SELECT stage, COUNT(*) AS n FROM leads GROUP BY stage").map((r) => [r.stage, r.n])),
    accounts: one<{ n: number }>(deps.sql, "SELECT COUNT(*) AS n FROM users")?.n ?? 0,
    savedDesigns: one<{ n: number }>(deps.sql, "SELECT COUNT(*) AS n FROM designs WHERE deleted_at IS NULL")?.n ?? 0,
  };
}

function cleanMembers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeEmail).filter((e): e is string => e !== null))].slice(0, 20);
}

export async function handle(request: Request, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method;
  const { sql } = deps;

  // un formulario de otro sitio no puede actuar con la sesión de la persona
  if (method !== "GET" && method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return fail(403, "origen_no_permitido");
  }

  const ipKey = (await sha256(`ip:${request.headers.get("cf-connecting-ip") ?? "local"}`)).slice(0, 24);
  const is = (m: string, p: string) => method === m && path === p;
  const match = (m: string, pattern: RegExp) => (method === m ? pattern.exec(path) : null);
  let m: RegExpExecArray | null;

  // ------------------------------------------------------------ público

  if (is("GET", "/api/health")) return json({ ok: true });

  if (is("GET", "/api/public/site")) {
    return json({ contact: contactOverrides(deps), features: { email: deps.config.emailEnabled, push: true } }, 200, { "cache-control": "public, max-age=60" });
  }

  if (is("POST", "/api/events")) {
    const body = await readBody(request, 2000);
    if (!body) return fail(400, "pedido_invalido");
    const type = EVENT_TYPES.find((t) => t === body.type);
    const interest = str(body.interest, 40);
    const placement = str(body.placement, 60);
    const page = str(body.path, 200);
    if (!type || !interest || !placement || !page || !/^[a-z0-9-]+$/.test(interest) || !/^[a-z0-9-]+$/.test(placement) || !page.startsWith("/")) return fail(400, "pedido_invalido");
    if (!allow(deps, `events:${ipKey}`, 60, HOUR)) return fail(429, "demasiados_pedidos");
    // sin identificadores: solo qué se tocó, dónde y cuándo
    sql.run("INSERT INTO events (at, type, interest, placement, path) VALUES (?, ?, ?, ?, ?)", deps.now(), type, Object.hasOwn(INTERESTS, interest) ? interest : "otro", placement, page.split("?")[0]);
    return json({ ok: true });
  }

  if (is("POST", "/api/consent")) {
    const body = await readBody(request, 2000);
    const id = body && str(body.id, 64);
    const version = body && str(body.version, 20);
    if (!body || !id || !version || !/^[a-zA-Z0-9-]{8,64}$/.test(id)) return fail(400, "pedido_invalido");
    if (!allow(deps, `consent:${ipKey}`, 30, HOUR)) return fail(429, "demasiados_pedidos");
    sql.run("INSERT OR REPLACE INTO consents (id, at, version, analytics, marketing) VALUES (?, ?, ?, ?, ?)", id, deps.now(), version, body.analytics === true ? 1 : 0, body.marketing === true ? 1 : 0);
    return json({ ok: true });
  }

  // el configurador de una empresa, para mostrarlo dentro de su página
  if (is("GET", "/api/public/embed")) {
    const slug = url.searchParams.get("t") ?? "";
    const tenant = SLUG.test(slug) ? one<TenantRow>(sql, "SELECT * FROM tenants WHERE slug = ? AND status = 'activa'", slug) : null;
    if (!tenant) return fail(404, "no_existe");
    const store = deps.tenant(tenant.id);
    const all = (await store.configurators()).filter((c) => c.active);
    const wanted = url.searchParams.get("k");
    const configurator = wanted ? all.find((c) => c.id === wanted) : all[0];
    const profile = await store.profile();
    // sin a dónde mandar la consulta, el configurador no se muestra
    if (!configurator || !isValidWhatsapp(profile.whatsapp)) return fail(404, "no_existe");
    if (allow(deps, `open:${ipKey}`, 120, HOUR)) await store.opened(configurator.id);
    return json({
      tenant: { name: tenant.name, whatsapp: profile.whatsapp, email: profile.email, tagline: profile.tagline },
      configurator: { id: configurator.id, name: configurator.name, family: configurator.family, params: configurator.params },
    });
  }

  if (is("POST", "/api/public/inquiries")) {
    const body = await readBody(request, 60_000);
    const slug = body && str(body.t, 40);
    const tenant = slug && SLUG.test(slug) ? one<TenantRow>(sql, "SELECT * FROM tenants WHERE slug = ? AND status = 'activa'", slug) : null;
    if (!body || !tenant) return fail(404, "no_existe");
    if (!allow(deps, `inquiry:${ipKey}`, 20, HOUR)) return fail(429, "demasiados_pedidos");
    const inquiry = await deps.tenant(tenant.id).addInquiry({ configuratorId: body.k, channel: body.channel, config: body.config, summary: body.summary, price: body.price });
    return inquiry ? json({ ok: true, id: inquiry.id }) : fail(400, "pedido_invalido");
  }

  // solo en desarrollo: los emails que se hubieran mandado, para probar el acceso de punta a punta
  if (deps.config.devOutbox && is("GET", "/api/dev/outbox")) return json({ mails: sql.all("SELECT recipient, subject, body, at FROM outbox ORDER BY id DESC LIMIT 20") });

  // ------------------------------------------------------------ acceso

  if (is("POST", "/api/auth/start")) {
    const body = await readBody(request, 2000);
    const email = body && normalizeEmail(body.email);
    if (!body || !email) return fail(400, "email_invalido");
    const result = await startLogin(deps, email, { marketing: body.marketing === true, origin: url.origin, ipKey });
    if (result === "sin_email") return fail(503, "email_no_disponible");
    if (result === "limite") return fail(429, "demasiados_pedidos");
    if (result === "fallo") return fail(502, "no_se_pudo_enviar");
    return json({ ok: true });
  }

  if (is("POST", "/api/auth/verify")) {
    const body = await readBody(request, 2000);
    if (!body) return fail(400, "pedido_invalido");
    if (!allow(deps, `verify:${ipKey}`, 30, 15 * MINUTE)) return fail(429, "demasiados_pedidos");
    const token = str(body.token, 100);
    const email = normalizeEmail(body.email);
    const code = str(body.code, 6);
    const result = await redeem(deps, token ? { token } : email && code && /^\d{6}$/.test(code) ? { email, code } : {});
    if (!result) return fail(401, "enlace_invalido");
    const session = await openSession(deps, result.user.id);
    return json({ user: publicUser(deps, result.user), designId: result.designId, created: result.created }, 200, { "set-cookie": sessionCookie(session, SESSION_TTL / 1000) });
  }

  if (is("POST", "/api/auth/logout")) {
    await closeSession(deps, request);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
  }

  // ------------------------------------------------------------ con sesión

  const user = await sessionUser(deps, request);

  if (is("GET", "/api/me")) return user ? json({ user: publicUser(deps, user) }) : fail(401, "sin_sesion");

  // lo que muestra la notificación del navegador: lo pide el propio navegador al recibir el aviso
  if (is("GET", "/api/push/notice")) {
    const notice = user ? one(sql, "SELECT title, body, url FROM notices WHERE user_id = ?", user.id) : null;
    return json({ notice });
  }

  if (path.startsWith("/api/") && !user) return fail(401, "sin_sesion");
  if (!user) return fail(404, "no_existe");

  if (is("PATCH", "/api/me")) {
    const body = await readBody(request, 2000);
    if (!body) return fail(400, "pedido_invalido");
    const now = deps.now();
    if (typeof body.marketing === "boolean") sql.run("UPDATE users SET marketing = ?, marketing_at = ? WHERE id = ?", body.marketing ? 1 : 0, now, user.id);
    if (typeof body.remindersEmail === "boolean") sql.run("UPDATE users SET reminders_email = ? WHERE id = ?", body.remindersEmail ? 1 : 0, user.id);
    if (typeof body.remindersPush === "boolean") sql.run("UPDATE users SET reminders_push = ? WHERE id = ?", body.remindersPush ? 1 : 0, user.id);
    const updated = one<User>(sql, "SELECT * FROM users WHERE id = ?", user.id)!;
    // activar o desactivar recordatorios vuelve a armar (o cancela) los pendientes
    if (typeof body.remindersEmail === "boolean" || typeof body.remindersPush === "boolean") await touch(deps, updated);
    return json({ user: publicUser(deps, updated) });
  }

  if (is("DELETE", "/api/me")) {
    deleteUser(deps, user);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
  }

  if (is("GET", "/api/designs")) return json({ ...listDesigns(deps, user.id), now: deps.now() });

  if (is("POST", "/api/designs/sync")) {
    const body = await readBody(request, 12_000_000);
    if (!body) return fail(400, "pedido_invalido");
    const { state, changed } = syncDesigns(deps, user.id, body);
    if (changed) await touch(deps, user);
    return json({ ...state, now: deps.now() });
  }

  if (is("GET", "/api/push/key")) return json({ key: (await vapidKeys(sql)).publicKey });

  if (is("POST", "/api/push/subscribe")) {
    const body = await readBody(request, 3000);
    if (!body || !validEndpoint(body.endpoint)) return fail(400, "suscripcion_invalida");
    sql.run("INSERT OR REPLACE INTO push_subs (endpoint, user_id, created_at) VALUES (?, ?, ?)", body.endpoint, user.id, deps.now());
    // cada persona, pocos navegadores: sobran los más viejos
    sql.run("DELETE FROM push_subs WHERE user_id = ? AND endpoint NOT IN (SELECT endpoint FROM push_subs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5)", user.id, user.id);
    return json({ ok: true });
  }

  if (is("POST", "/api/push/unsubscribe")) {
    const body = await readBody(request, 3000);
    if (body && typeof body.endpoint === "string") sql.run("DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?", body.endpoint, user.id);
    else sql.run("DELETE FROM push_subs WHERE user_id = ?", user.id);
    return json({ ok: true });
  }

  // ------------------------------------------------------------ panel de empresa

  if (is("GET", "/api/panel")) return json({ tenants: tenantsOf(deps, user).map((t) => tenantView(deps, t)) });

  if ((m = /^\/api\/panel\/([0-9a-f-]{36})(\/.*)?$/.exec(path))) {
    const tenant = tenantsOf(deps, user).find((t) => t.id === m![1]);
    // ser de otra empresa y no existir se contestan igual: no se revela qué empresas hay
    if (!tenant) return fail(404, "no_existe");
    const store = deps.tenant(tenant.id);
    const rest = m[2] ?? "";

    if (method === "GET" && rest === "") {
      return json({ tenant: tenantView(deps, tenant), profile: await store.profile(), configurators: await store.configurators(), inquiries: await store.inquiries(), usage: await store.usage(30) });
    }
    if (method === "PUT" && rest === "/profile") {
      const profile = await store.setProfile(await readBody(request, 3000));
      return profile ? json({ profile }) : fail(400, "datos_invalidos");
    }
    if (method === "POST" && rest === "/configurators") {
      const saved = await store.saveConfigurator(await readBody(request, 20_000), tenant.configurator_limit);
      if (saved === "limite") return fail(409, "limite_del_plan");
      return saved === "invalido" ? fail(400, "datos_invalidos") : json({ configurator: saved });
    }
    const sub = /^\/(configurators|inquiries)\/([0-9a-f-]{36})$/.exec(rest);
    if (sub && sub[1] === "configurators" && method === "DELETE") {
      await store.removeConfigurator(sub[2]);
      return json({ ok: true });
    }
    if (sub && sub[1] === "inquiries" && method === "PATCH") {
      const body = await readBody(request, 1000);
      return (await store.setInquiryStatus(sub[2], body?.status)) ? json({ ok: true }) : fail(400, "datos_invalidos");
    }
    return fail(404, "no_existe");
  }

  // ------------------------------------------------------------ administración

  if (!path.startsWith("/api/admin")) return fail(404, "no_existe");
  if (!isAdmin(deps, user)) return fail(403, "sin_permiso");

  if (is("GET", "/api/admin/overview")) {
    return json({
      contact: contactOverrides(deps),
      stats: stats(deps),
      leads: sql.all("SELECT * FROM leads ORDER BY updated_at DESC LIMIT 200"),
      tenants: sql.all<TenantRow>("SELECT * FROM tenants ORDER BY created_at").map((t) => tenantView(deps, t)),
      emailEnabled: deps.config.emailEnabled,
    });
  }

  if (is("PUT", "/api/admin/contact")) {
    const body = await readBody(request, 2000);
    const whatsapp = body && typeof body.whatsapp === "string" ? cleanWhatsapp(body.whatsapp) : "";
    const email = body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    // el contacto es lo que abre cada botón del sitio: no se guarda uno que no sirva
    if (!isValidWhatsapp(whatsapp) || !isValidEmail(email)) return fail(400, "datos_invalidos");
    sql.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('contact_whatsapp', ?)", whatsapp);
    sql.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('contact_email', ?)", email);
    return json({ contact: contactOverrides(deps) });
  }

  const editLead = match("PATCH", /^\/api\/admin\/leads\/([0-9a-f-]{36})$/);
  if (is("POST", "/api/admin/leads") || editLead) {
    const body = await readBody(request, 6000);
    if (!body) return fail(400, "pedido_invalido");
    const existing = editLead ? one<Record<string, string>>(sql, "SELECT * FROM leads WHERE id = ?", editLead[1]) : null;
    if (editLead && !existing) return fail(404, "no_existe");
    const pick = (key: string, max: number, fallback: string) => (typeof body[key] === "string" ? (body[key] as string).trim().slice(0, max) : (existing?.[key] ?? fallback));
    const stage = LEAD_STAGES.find((s) => s === body.stage) ?? (existing?.stage as string | undefined) ?? "consulta";
    const channel = LEAD_CHANNELS.find((c) => c === body.channel) ?? (existing?.channel as string | undefined) ?? "whatsapp";
    const name = pick("name", 120, "");
    if (!name) return fail(400, "datos_invalidos");
    const id = existing?.id ?? crypto.randomUUID();
    const now = deps.now();
    sql.run(
      "INSERT OR REPLACE INTO leads (id, created_at, updated_at, name, company, channel, interest, stage, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      existing ? Number(existing.created_at) : now,
      now,
      name,
      pick("company", 120, ""),
      channel,
      pick("interest", 40, "general"),
      stage,
      pick("notes", 2000, ""),
    );
    return json({ lead: one(sql, "SELECT * FROM leads WHERE id = ?", id) });
  }

  if ((m = match("DELETE", /^\/api\/admin\/leads\/([0-9a-f-]{36})$/))) {
    sql.run("DELETE FROM leads WHERE id = ?", m[1]);
    return json({ ok: true });
  }

  if (is("POST", "/api/admin/tenants")) {
    const body = await readBody(request, 6000);
    const name = body && typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    const slug = body && typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const limit = body ? Number(body.configuratorLimit) : NaN;
    if (!body || !name || !SLUG.test(slug) || !Number.isInteger(limit) || limit < 1 || limit > 100) return fail(400, "datos_invalidos");
    if (one(sql, "SELECT id FROM tenants WHERE slug = ?", slug)) return fail(409, "ya_existe");
    const id = crypto.randomUUID();
    sql.run("INSERT INTO tenants (id, slug, name, plan, configurator_limit, status, created_at) VALUES (?, ?, ?, ?, ?, 'activa', ?)", id, slug, name, typeof body.plan === "string" ? body.plan.trim().slice(0, 40) : "", limit, deps.now());
    for (const email of cleanMembers(body.members)) sql.run("INSERT OR IGNORE INTO tenant_members (tenant_id, email) VALUES (?, ?)", id, email);
    return json({ tenant: tenantView(deps, one<TenantRow>(sql, "SELECT * FROM tenants WHERE id = ?", id)!) });
  }

  if ((m = /^\/api\/admin\/tenants\/([0-9a-f-]{36})$/.exec(path)) && UUID.test(m[1])) {
    const tenant = one<TenantRow>(sql, "SELECT * FROM tenants WHERE id = ?", m[1]);
    if (!tenant) return fail(404, "no_existe");
    if (method === "DELETE") {
      // se van también los datos de la empresa, que viven en su propia base
      await deps.tenant(tenant.id).wipe();
      sql.run("DELETE FROM tenant_members WHERE tenant_id = ?", tenant.id);
      sql.run("DELETE FROM tenants WHERE id = ?", tenant.id);
      return json({ ok: true });
    }
    if (method === "PATCH") {
      const body = await readBody(request, 6000);
      if (!body) return fail(400, "pedido_invalido");
      const limit = body.configuratorLimit === undefined ? tenant.configurator_limit : Number(body.configuratorLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) return fail(400, "datos_invalidos");
      sql.run(
        "UPDATE tenants SET name = ?, plan = ?, configurator_limit = ?, status = ? WHERE id = ?",
        typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : tenant.name,
        typeof body.plan === "string" ? body.plan.trim().slice(0, 40) : tenant.plan,
        limit,
        body.status === "activa" || body.status === "pausada" ? body.status : tenant.status,
        tenant.id,
      );
      if (Array.isArray(body.members)) {
        sql.run("DELETE FROM tenant_members WHERE tenant_id = ?", tenant.id);
        for (const email of cleanMembers(body.members)) sql.run("INSERT OR IGNORE INTO tenant_members (tenant_id, email) VALUES (?, ?)", tenant.id, email);
      }
      return json({ tenant: tenantView(deps, one<TenantRow>(sql, "SELECT * FROM tenants WHERE id = ?", tenant.id)!) });
    }
  }

  return fail(404, "no_existe");
}
