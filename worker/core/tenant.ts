/**
 * Los datos de una empresa: su perfil, sus configuradores, las consultas de
 * sus clientes y su uso. Cada empresa tiene su propia base; nada de esto se
 * guarda junto a lo de otra.
 */

import { isValidEmail, isValidWhatsapp, cleanWhatsapp } from "../../src/lib/site.ts";
import { one, type Sql } from "./sql.ts";

export type TenantProfile = { whatsapp: string; email: string; tagline: string };

/** lo que una empresa ajusta de un configurador sin tocar código */
export type ConfiguratorParams = {
  /** margen sobre el costo: 0.45 es costo + 45 % */
  margin?: number;
  /** qué terminaciones del catálogo ofrece; sin esto, todas */
  materials?: string[];
  /** precio de la placa de cada terminación, en pesos */
  boardPrices?: Record<string, number>;
};

export type Configurator = { id: string; family: string; name: string; active: boolean; params: ConfiguratorParams; createdAt: number; updatedAt: number };

export type Inquiry = {
  id: string;
  configuratorId: string;
  at: number;
  /** por dónde eligió mandarla la persona; no confirma que el mensaje se haya enviado */
  channel: string;
  config: unknown;
  summary: { dimensions: string; lines: string[] };
  price: number | null;
  status: "nueva" | "contactada" | "cotizada" | "ganada" | "descartada";
};

export const INQUIRY_STATUSES: Inquiry["status"][] = ["nueva", "contactada", "cotizada", "ganada", "descartada"];

export type Usage = { configuratorId: string; opens: number; inquiries: number };

export interface TenantApi {
  profile(): Promise<TenantProfile>;
  setProfile(input: unknown): Promise<TenantProfile | null>;
  configurators(): Promise<Configurator[]>;
  /** crea o edita; "limite" si el plan no deja sumar otro */
  saveConfigurator(input: unknown, limit: number): Promise<Configurator | "limite" | "invalido">;
  removeConfigurator(id: string): Promise<void>;
  opened(configuratorId: string): Promise<void>;
  addInquiry(input: unknown): Promise<Inquiry | null>;
  inquiries(): Promise<Inquiry[]>;
  setInquiryStatus(id: string, status: unknown): Promise<boolean>;
  usage(days: number): Promise<Usage[]>;
  wipe(): Promise<void>;
}

const FAMILIES_WITH_ENGINE = ["placares"];
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function cleanParams(raw: unknown): ConfiguratorParams {
  const p = isObject(raw) ? raw : {};
  const out: ConfiguratorParams = {};
  if (typeof p.margin === "number" && Number.isFinite(p.margin) && p.margin >= 0 && p.margin <= 5) out.margin = Math.round(p.margin * 1000) / 1000;
  if (Array.isArray(p.materials)) {
    const ids = [...new Set(p.materials.filter((m): m is string => typeof m === "string" && /^[a-z0-9-]{1,30}$/.test(m)))].slice(0, 40);
    if (ids.length) out.materials = ids;
  }
  if (isObject(p.boardPrices)) {
    const prices: Record<string, number> = {};
    for (const [id, value] of Object.entries(p.boardPrices).slice(0, 40)) {
      if (/^[a-z0-9-]{1,30}$/.test(id) && typeof value === "number" && Number.isFinite(value) && value > 0 && value < 1e9) prices[id] = Math.round(value);
    }
    if (Object.keys(prices).length) out.boardPrices = prices;
  }
  return out;
}

type ConfiguratorRow = { id: string; family: string; name: string; params: string; active: number; created_at: number; updated_at: number };
type InquiryRow = { id: string; configurator_id: string; at: number; channel: string; config: string; summary: string; price: number | null; status: string };

const toConfigurator = (r: ConfiguratorRow): Configurator => ({ id: r.id, family: r.family, name: r.name, active: r.active === 1, params: cleanParams(JSON.parse(r.params)), createdAt: r.created_at, updatedAt: r.updated_at });

/** la lógica de una empresa sobre su propia base */
export function tenantStore(sql: Sql, now: () => number): TenantApi {
  const getProfile = (): TenantProfile => {
    const rows = Object.fromEntries(sql.all<{ key: string; value: string }>("SELECT key, value FROM profile").map((r) => [r.key, r.value]));
    return { whatsapp: rows.whatsapp ?? "", email: rows.email ?? "", tagline: rows.tagline ?? "" };
  };
  const bump = (configuratorId: string, column: "opens" | "inquiries") => {
    sql.run(`INSERT INTO usage (configurator_id, day, ${column}) VALUES (?, ?, 1) ON CONFLICT (configurator_id, day) DO UPDATE SET ${column} = ${column} + 1`, configuratorId, day(now()));
  };

  return {
    async profile() {
      return getProfile();
    },

    async setProfile(input) {
      if (!isObject(input)) return null;
      const whatsapp = cleanWhatsapp(text(input.whatsapp, 30));
      const email = text(input.email, 254).toLowerCase();
      // el WhatsApp es a donde llegan las consultas: sin un número válido no se guarda
      if (!isValidWhatsapp(whatsapp) || (email !== "" && !isValidEmail(email))) return null;
      for (const [key, value] of Object.entries({ whatsapp, email, tagline: text(input.tagline, 80) })) sql.run("INSERT OR REPLACE INTO profile (key, value) VALUES (?, ?)", key, value);
      return getProfile();
    },

    async configurators() {
      return sql.all<ConfiguratorRow>("SELECT * FROM configurators ORDER BY created_at").map(toConfigurator);
    },

    async saveConfigurator(input, limit) {
      if (!isObject(input)) return "invalido";
      const name = text(input.name, 80);
      if (!name) return "invalido";
      const params = JSON.stringify(cleanParams(input.params));
      const active = input.active === false ? 0 : 1;
      const existing = typeof input.id === "string" ? one<ConfiguratorRow>(sql, "SELECT * FROM configurators WHERE id = ?", input.id) : null;
      if (existing) {
        sql.run("UPDATE configurators SET name = ?, params = ?, active = ?, updated_at = ? WHERE id = ?", name, params, active, now(), existing.id);
        return toConfigurator(one<ConfiguratorRow>(sql, "SELECT * FROM configurators WHERE id = ?", existing.id)!);
      }
      const family = text(input.family, 40);
      if (!FAMILIES_WITH_ENGINE.includes(family)) return "invalido";
      // el plan dice cuántos configuradores puede tener la empresa
      const count = one<{ n: number }>(sql, "SELECT COUNT(*) AS n FROM configurators")?.n ?? 0;
      if (count >= limit) return "limite";
      const id = crypto.randomUUID();
      sql.run("INSERT INTO configurators (id, family, name, params, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id, family, name, params, active, now(), now());
      return toConfigurator(one<ConfiguratorRow>(sql, "SELECT * FROM configurators WHERE id = ?", id)!);
    },

    async removeConfigurator(id) {
      sql.run("DELETE FROM configurators WHERE id = ?", id);
      sql.run("DELETE FROM usage WHERE configurator_id = ?", id);
    },

    async opened(configuratorId) {
      bump(configuratorId, "opens");
    },

    async addInquiry(input) {
      if (!isObject(input) || !isObject(input.config)) return null;
      const configuratorId = text(input.configuratorId, 64);
      if (!one(sql, "SELECT id FROM configurators WHERE id = ? AND active = 1", configuratorId)) return null;
      const config = JSON.stringify(input.config);
      if (config.length > 32_000) return null;
      const s = isObject(input.summary) ? input.summary : {};
      const summary = { dimensions: text(s.dimensions, 160), lines: (Array.isArray(s.lines) ? s.lines : []).filter((l): l is string => typeof l === "string").slice(0, 12).map((l) => l.slice(0, 160)) };
      const channel = ["whatsapp", "email", "share"].includes(text(input.channel, 20)) ? text(input.channel, 20) : "whatsapp";
      const price = typeof input.price === "number" && Number.isFinite(input.price) && input.price >= 0 ? Math.round(input.price) : null;
      const id = crypto.randomUUID();
      sql.run("INSERT INTO inquiries (id, configurator_id, at, channel, config, summary, price, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'nueva')", id, configuratorId, now(), channel, config, JSON.stringify(summary), price);
      bump(configuratorId, "inquiries");
      // se guardan las últimas mil: una base por empresa no crece sin tope
      sql.run("DELETE FROM inquiries WHERE id NOT IN (SELECT id FROM inquiries ORDER BY at DESC LIMIT 1000)");
      return { id, configuratorId, at: now(), channel, config: input.config, summary, price, status: "nueva" };
    },

    async inquiries() {
      return sql.all<InquiryRow>("SELECT * FROM inquiries ORDER BY at DESC LIMIT 200").map((r) => ({
        id: r.id,
        configuratorId: r.configurator_id,
        at: r.at,
        channel: r.channel,
        config: JSON.parse(r.config),
        summary: JSON.parse(r.summary),
        price: r.price,
        status: r.status as Inquiry["status"],
      }));
    },

    async setInquiryStatus(id, status) {
      if (!INQUIRY_STATUSES.includes(status as Inquiry["status"]) || !one(sql, "SELECT id FROM inquiries WHERE id = ?", id)) return false;
      sql.run("UPDATE inquiries SET status = ? WHERE id = ?", status as string, id);
      return true;
    },

    async usage(days) {
      return sql
        .all<{ configurator_id: string; opens: number; inquiries: number }>(
          "SELECT configurator_id, SUM(opens) AS opens, SUM(inquiries) AS inquiries FROM usage WHERE day >= ? GROUP BY configurator_id",
          day(now() - days * 86_400_000),
        )
        .map((r) => ({ configuratorId: r.configurator_id, opens: r.opens, inquiries: r.inquiries }));
    },

    async wipe() {
      for (const table of ["profile", "configurators", "inquiries", "usage"]) sql.run(`DELETE FROM ${table}`);
    },
  };
}
