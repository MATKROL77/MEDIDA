/**
 * Sincronización de diseños entre dispositivos.
 *
 * El navegador manda lo que cambió y lo que borró; el servidor lo junta con lo
 * que tiene y devuelve el resultado. Para cada diseño gana la versión
 * modificada más tarde. Valida con las mismas reglas que el navegador.
 */

import { LIMITS, sanitizeDesign, type DesignState, type SavedDesign, type Tombstone } from "../../src/lib/designs.ts";
import { DAY, type Deps } from "./types.ts";

type DesignRow = {
  id: string;
  type: string;
  name: string;
  config: string;
  summary: string;
  price: number | null;
  preview: string | null;
  favorite: number;
  cart: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

const TOMBSTONE_TTL = 90 * DAY;

function toDesign(row: DesignRow): SavedDesign | null {
  try {
    return sanitizeDesign({ ...row, config: JSON.parse(row.config), summary: JSON.parse(row.summary), favorite: row.favorite === 1, cart: row.cart === 1, createdAt: row.created_at, updatedAt: row.updated_at });
  } catch {
    return null;
  }
}

export function listDesigns(deps: Deps, userId: string): DesignState {
  const rows = deps.sql.all<DesignRow>("SELECT * FROM designs WHERE user_id = ? ORDER BY updated_at DESC", userId);
  return {
    designs: rows.filter((r) => r.deleted_at === null).map(toDesign).filter((d): d is SavedDesign => d !== null),
    tombstones: rows.filter((r) => r.deleted_at !== null).map((r) => ({ id: r.id, deletedAt: r.deleted_at! })),
  };
}

export function syncDesigns(deps: Deps, userId: string, body: { upserts?: unknown; deletes?: unknown }): { state: DesignState; changed: boolean } {
  const now = deps.now();
  const upserts = (Array.isArray(body.upserts) ? body.upserts.slice(0, LIMITS.designs * 2) : []).map(sanitizeDesign).filter((d): d is SavedDesign => d !== null);
  const deletes = (Array.isArray(body.deletes) ? body.deletes.slice(0, 500) : []).filter(
    (t): t is Tombstone => typeof t === "object" && t !== null && typeof (t as Tombstone).id === "string" && Number.isFinite((t as Tombstone).deletedAt),
  );
  let changed = false;
  const current = (id: string) => deps.sql.all<{ updated_at: number; deleted_at: number | null }>("SELECT updated_at, deleted_at FROM designs WHERE user_id = ? AND id = ?", userId, id)[0];

  for (const d of upserts) {
    // un reloj adelantado no puede dejar un diseño "en el futuro" e imposible de pisar
    const updatedAt = Math.min(d.updatedAt, now);
    const row = current(d.id);
    if (row && (row.updated_at >= updatedAt || (row.deleted_at !== null && row.deleted_at >= updatedAt))) continue;
    deps.sql.run(
      `INSERT OR REPLACE INTO designs (user_id, id, type, name, config, summary, price, preview, favorite, cart, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      userId,
      d.id,
      d.type,
      d.name,
      JSON.stringify(d.config),
      JSON.stringify(d.summary),
      d.price,
      d.preview,
      d.favorite ? 1 : 0,
      d.cart ? 1 : 0,
      Math.min(d.createdAt, updatedAt),
      updatedAt,
    );
    changed = true;
  }

  for (const t of deletes) {
    const deletedAt = Math.min(t.deletedAt, now);
    const row = current(t.id);
    if (!row || row.deleted_at !== null || row.updated_at > deletedAt) continue;
    // queda la marca del borrado, sin el contenido
    deps.sql.run("UPDATE designs SET deleted_at = ?, config = '{}', summary = '{}', preview = NULL WHERE user_id = ? AND id = ?", deletedAt, userId, t.id);
    changed = true;
  }

  // el mismo tope que en el navegador: sobran los más viejos
  const live = deps.sql.all<{ id: string }>("SELECT id FROM designs WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC", userId);
  for (const extra of live.slice(LIMITS.designs)) deps.sql.run("UPDATE designs SET deleted_at = ?, config = '{}', summary = '{}', preview = NULL WHERE user_id = ? AND id = ?", now, userId, extra.id);
  deps.sql.run("DELETE FROM designs WHERE user_id = ? AND deleted_at IS NOT NULL AND deleted_at < ?", userId, now - TOMBSTONE_TTL);

  return { state: listDesigns(deps, userId), changed };
}
