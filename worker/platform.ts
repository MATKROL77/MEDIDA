/**
 * El servidor de MEDIDA en Cloudflare: un Durable Object con su base SQLite.
 *
 * Guarda las cuentas, los diseños sincronizados, los consentimientos, los
 * clics de contacto, el contacto vigente y la lista de empresas. Los datos de
 * cada empresa no están acá: viven en su propio Durable Object (TenantDO).
 */

import { DurableObject } from "cloudflare:workers";

import { defaultContact } from "../src/lib/site.ts";
import { handle } from "./core/app.ts";
import { pushRequest, vapidKeys } from "./core/push.ts";
import { arm, processDue, purge } from "./core/reminders.ts";
import { PLATFORM_SCHEMA, TENANT_SCHEMA } from "./core/schema.ts";
import { migrate, one, type Sql } from "./core/sql.ts";
import { tenantStore, type TenantApi } from "./core/tenant.ts";
import type { Deps, Mail } from "./core/types.ts";

export type Env = {
  ASSETS: Fetcher;
  PLATFORM: DurableObjectNamespace<PlatformDO>;
  TENANT: DurableObjectNamespace<TenantDO>;
  /** emails con acceso al panel de administración, separados por coma */
  ADMIN_EMAILS?: string;
  /** remitente de los emails: "MEDIDA <acceso@tu-dominio.com>" */
  EMAIL_FROM?: string;
  /** secreto: la clave del proveedor de email (Resend) */
  RESEND_API_KEY?: string;
  /** solo en desarrollo local: guarda los emails en vez de mandarlos */
  DEV_OUTBOX?: string;
};

const sqlOf = (state: DurableObjectState): Sql => ({
  all: (query, ...params) => state.storage.sql.exec(query, ...params).toArray() as never,
  run: (query, ...params) => {
    state.storage.sql.exec(query, ...params).toArray();
  },
});

export class PlatformDO extends DurableObject<Env> {
  private deps: Deps;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    const sql = sqlOf(state);
    migrate(sql, PLATFORM_SCHEMA);
    const devOutbox = env.DEV_OUTBOX === "1";

    this.deps = {
      sql,
      now: Date.now,
      config: {
        adminEmails: (env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
        emailEnabled: devOutbox || !!env.RESEND_API_KEY,
        devOutbox,
      },
      sendEmail: (mail) => this.sendEmail(mail),
      sendPush: (endpoint) => this.sendPush(endpoint),
      schedule: (at) => state.storage.setAlarm(at),
      tenant: (id) => env.TENANT.get(env.TENANT.idFromName(id)) as unknown as TenantApi,
    };
  }

  fetch(request: Request): Promise<Response> {
    return handle(request, this.deps).catch((error) => {
      console.error("error en la API", error);
      return new Response(JSON.stringify({ error: "error_interno" }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });
    });
  }

  /** el servidor se despierta solo para mandar los recordatorios que vencieron y limpiar lo viejo */
  async alarm() {
    await processDue(this.deps);
    purge(this.deps);
    await arm(this.deps);
  }

  private async sendEmail(mail: Mail): Promise<boolean> {
    if (this.deps.config.devOutbox) {
      this.deps.sql.run("INSERT INTO outbox (at, recipient, subject, body) VALUES (?, ?, ?, ?)", Date.now(), mail.to, mail.subject, mail.text);
      return true;
    }
    if (!this.env.RESEND_API_KEY) return false;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${this.env.RESEND_API_KEY}`, "content-type": "application/json" },
        // sin dominio propio, Resend solo deja escribirle al dueño de la cuenta desde su dirección de prueba
        body: JSON.stringify({ from: this.env.EMAIL_FROM || "MEDIDA <onboarding@resend.dev>", to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
      });
      if (!res.ok) console.error("el proveedor de email respondió", res.status, await res.text());
      return res.ok;
    } catch (error) {
      console.error("no se pudo mandar el email", error);
      return false;
    }
  }

  private async sendPush(endpoint: string): Promise<"ok" | "gone" | "error"> {
    try {
      const contact = one<{ value: string }>(this.deps.sql, "SELECT value FROM meta WHERE key = 'contact_email'")?.value ?? defaultContact.email;
      const { url, headers } = await pushRequest(endpoint, await vapidKeys(this.deps.sql), contact, Date.now());
      const res = await fetch(url, { method: "POST", headers });
      if (res.status === 404 || res.status === 410) return "gone";
      return res.ok ? "ok" : "error";
    } catch {
      return "error";
    }
  }
}

/**
 * La base de una empresa. Hay una por empresa y no comparte almacenamiento
 * con ninguna otra: lo que se guarda acá no se puede leer desde otra empresa
 * ni por un error de consulta.
 */
export class TenantDO extends DurableObject<Env> {
  private store: TenantApi;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    const sql = sqlOf(state);
    migrate(sql, TENANT_SCHEMA);
    this.store = tenantStore(sql, Date.now);
  }

  profile() {
    return this.store.profile();
  }
  setProfile(input: unknown) {
    return this.store.setProfile(input);
  }
  configurators() {
    return this.store.configurators();
  }
  saveConfigurator(input: unknown, limit: number) {
    return this.store.saveConfigurator(input, limit);
  }
  removeConfigurator(id: string) {
    return this.store.removeConfigurator(id);
  }
  opened(configuratorId: string) {
    return this.store.opened(configuratorId);
  }
  addInquiry(input: unknown) {
    return this.store.addInquiry(input);
  }
  inquiries() {
    return this.store.inquiries();
  }
  setInquiryStatus(id: string, status: unknown) {
    return this.store.setInquiryStatus(id, status);
  }
  usage(days: number) {
    return this.store.usage(days);
  }
  wipe() {
    return this.store.wipe();
  }
}
