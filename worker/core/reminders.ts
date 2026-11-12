/**
 * Recordatorios de diseños guardados.
 *
 * Solo para quien los activó. Son dos, y nada más: al día y a los tres días
 * de la última vez que la persona tocó sus diseños. Si vuelve a editar, se
 * cancelan y la cuenta empieza de nuevo; si borra todo o los desactiva, se
 * cancelan y listo. Cada aviso lleva un enlace de un solo uso para volver.
 */

import { familyById } from "../../src/lib/families.ts";
import { REMINDER_TTL, issueToken, type User } from "./auth.ts";
import { reminderMail, reminderText, type ReminderInfo } from "./email.ts";
import { one } from "./sql.ts";
import { DAY, HOUR, type Deps } from "./types.ts";

export const REMINDER_STEPS = [
  { step: 1, after: 24 * HOUR },
  { step: 2, after: 3 * DAY },
] as const;

const wants = (user: User) => user.reminders_email === 1 || user.reminders_push === 1;
const liveDesigns = (deps: Deps, userId: string) => one<{ n: number }>(deps.sql, "SELECT COUNT(*) AS n FROM designs WHERE user_id = ? AND deleted_at IS NULL", userId)?.n ?? 0;

/** cuándo le toca al servidor despertarse solo: el próximo recordatorio, o la limpieza diaria */
export async function arm(deps: Deps) {
  const next = one<{ due: number | null }>(deps.sql, "SELECT MIN(due_at) AS due FROM reminders WHERE sent_at IS NULL")?.due;
  await deps.schedule(Math.min(next ?? Infinity, deps.now() + DAY));
}

/** la persona tocó sus diseños (o cambió sus preferencias): se cancela lo pendiente y la cuenta vuelve a empezar */
export async function touch(deps: Deps, user: User) {
  const now = deps.now();
  deps.sql.run("UPDATE users SET last_activity_at = ? WHERE id = ?", now, user.id);
  deps.sql.run("DELETE FROM reminders WHERE user_id = ?", user.id);
  if (wants(user) && liveDesigns(deps, user.id) > 0) {
    for (const { step, after } of REMINDER_STEPS) deps.sql.run("INSERT INTO reminders (user_id, step, due_at) VALUES (?, ?, ?)", user.id, step, now + after);
  }
  await arm(deps);
}

type Due = { user_id: string; step: number; due_at: number };

/** manda los recordatorios que ya vencieron; devuelve cuántos mandó */
export async function processDue(deps: Deps): Promise<number> {
  const now = deps.now();
  const origin = one<{ value: string }>(deps.sql, "SELECT value FROM meta WHERE key = 'origin'")?.value;
  let sent = 0;

  for (const due of deps.sql.all<Due>("SELECT user_id, step, due_at FROM reminders WHERE sent_at IS NULL AND due_at <= ? ORDER BY due_at", now)) {
    const user = one<User>(deps.sql, "SELECT * FROM users WHERE id = ?", due.user_id);
    const design = one<{ id: string; name: string; type: string }>(deps.sql, "SELECT id, name, type FROM designs WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1", due.user_id);
    // ya no corresponde: se fue la cuenta, borró todo o desactivó los avisos
    if (!user || !design || !wants(user) || !origin) {
      deps.sql.run("DELETE FROM reminders WHERE user_id = ?", due.user_id);
      continue;
    }
    // un paso atrasado no se manda pegado al siguiente
    const later = one<{ step: number }>(deps.sql, "SELECT step FROM reminders WHERE user_id = ? AND step > ? AND sent_at IS NULL AND due_at <= ?", user.id, due.step, now);
    if (later) {
      deps.sql.run("UPDATE reminders SET sent_at = ? WHERE user_id = ? AND step = ?", now, user.id, due.step);
      continue;
    }

    const { token } = await issueToken(deps, user.email, "reminder", REMINDER_TTL, { designId: design.id });
    const info: ReminderInfo = {
      step: due.step,
      designName: design.name,
      noun: familyById(design.type)?.noun ?? "diseño",
      others: liveDesigns(deps, user.id) - 1,
      link: `${origin}/cuenta/verificar/#t=${token}`,
      accountLink: `${origin}/cuenta/`,
    };
    let delivered = false;
    if (user.reminders_email === 1 && deps.config.emailEnabled) delivered = (await deps.sendEmail(reminderMail(user.email, info))) || delivered;
    if (user.reminders_push === 1) {
      const { title, body } = reminderText(info);
      // el navegador pide este texto al recibir el aviso; el enlace no lleva nada secreto
      deps.sql.run("INSERT OR REPLACE INTO notices (user_id, title, body, url, created_at) VALUES (?, ?, ?, ?, ?)", user.id, title, body, `/mis-disenos/?abrir=${design.id}`, now);
      for (const sub of deps.sql.all<{ endpoint: string }>("SELECT endpoint FROM push_subs WHERE user_id = ?", user.id)) {
        const result = await deps.sendPush(sub.endpoint);
        if (result === "gone") deps.sql.run("DELETE FROM push_subs WHERE endpoint = ?", sub.endpoint);
        delivered = result === "ok" || delivered;
      }
    }
    deps.sql.run("UPDATE reminders SET sent_at = ? WHERE user_id = ? AND step = ?", now, user.id, due.step);
    if (delivered) sent++;
  }
  return sent;
}

/** limpieza diaria: lo vencido se va, y lo que la política de privacidad dice que dura un tiempo, dura eso */
export function purge(deps: Deps) {
  const now = deps.now();
  deps.sql.run("DELETE FROM login_tokens WHERE expires_at < ?", now - DAY);
  deps.sql.run("DELETE FROM sessions WHERE expires_at < ?", now);
  deps.sql.run("DELETE FROM rate WHERE reset_at < ?", now);
  deps.sql.run("DELETE FROM events WHERE at < ?", now - 13 * 30 * DAY);
  deps.sql.run("DELETE FROM consents WHERE at < ?", now - 24 * 30 * DAY);
  deps.sql.run("DELETE FROM notices WHERE created_at < ?", now - 30 * DAY);
  deps.sql.run("DELETE FROM outbox WHERE at < ?", now - DAY);
}
