/**
 * Acceso por email, sin contraseña.
 *
 * La persona pide entrar con su email y recibe un enlace y un código. Los dos
 * vencen rápido y sirven una sola vez. De ninguno se guarda el valor, solo su
 * huella. Al verificar se abre una sesión que vive en una cookie que los
 * scripts de la página no pueden leer.
 */

import { isValidEmail } from "../../src/lib/site.ts";
import { randomCode, randomToken, safeEqual, sha256 } from "./crypto.ts";
import { loginMail } from "./email.ts";
import { SESSION_COOKIE, readCookie } from "./http.ts";
import { one } from "./sql.ts";
import { DAY, HOUR, MINUTE, type Deps } from "./types.ts";

export const LOGIN_TTL = 15 * MINUTE;
export const REMINDER_TTL = 7 * DAY;
export const SESSION_TTL = 30 * DAY;
const MAX_CODE_ATTEMPTS = 5;

export type User = {
  id: string;
  email: string;
  created_at: number;
  marketing: number;
  marketing_at: number | null;
  reminders_email: number;
  reminders_push: number;
  last_activity_at: number;
};

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return isValidEmail(email) ? email : null;
}

/** cuenta un intento; false si ya se pasó del tope en la ventana */
export function allow(deps: Deps, key: string, limit: number, windowMs: number): boolean {
  const now = deps.now();
  const row = one<{ count: number; reset_at: number }>(deps.sql, "SELECT count, reset_at FROM rate WHERE key = ?", key);
  if (!row || row.reset_at <= now) {
    deps.sql.run("INSERT OR REPLACE INTO rate (key, count, reset_at) VALUES (?, 1, ?)", key, now + windowMs);
    return true;
  }
  if (row.count >= limit) return false;
  deps.sql.run("UPDATE rate SET count = count + 1 WHERE key = ?", key);
  return true;
}

/** crea un enlace de un solo uso para ese email; devuelve el valor, que no queda guardado */
export async function issueToken(deps: Deps, email: string, purpose: "login" | "reminder", ttl: number, extra: { marketing?: boolean; designId?: string | null } = {}) {
  const token = randomToken();
  const code = purpose === "login" ? randomCode() : null;
  const now = deps.now();
  deps.sql.run(
    "INSERT INTO login_tokens (hash, email, code_hash, purpose, design_id, marketing, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    await sha256(token),
    email,
    code ? await sha256(`${email}:${code}`) : null,
    purpose,
    extra.designId ?? null,
    extra.marketing ? 1 : 0,
    now,
    now + ttl,
  );
  return { token, code };
}

export async function startLogin(deps: Deps, email: string, opts: { marketing: boolean; origin: string; ipKey: string }): Promise<"ok" | "limite" | "sin_email" | "fallo"> {
  if (!deps.config.emailEnabled) return "sin_email";
  // pocos pedidos por casilla y por origen: nadie puede usar esto para llenarle la casilla a otro
  if (!allow(deps, `login:${email}`, 4, 15 * MINUTE) || !allow(deps, `login-ip:${opts.ipKey}`, 12, HOUR)) return "limite";
  const { token, code } = await issueToken(deps, email, "login", LOGIN_TTL, { marketing: opts.marketing });
  deps.sql.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('origin', ?)", opts.origin);
  const sent = await deps.sendEmail(loginMail(email, `${opts.origin}/cuenta/verificar/#t=${token}`, code!));
  return sent ? "ok" : "fallo";
}

type TokenRow = { hash: string; email: string; code_hash: string | null; purpose: string; design_id: string | null; marketing: number; expires_at: number; used_at: number | null; attempts: number };

/**
 * Canjea un enlace (token) o un código (email + código). Devuelve la persona
 * y, si el enlace venía de un recordatorio, el diseño al que apuntaba.
 */
export async function redeem(deps: Deps, input: { token?: string; email?: string; code?: string }): Promise<{ user: User; designId: string | null; created: boolean } | null> {
  const now = deps.now();
  let row: TokenRow | null = null;

  if (input.token) {
    row = one<TokenRow>(deps.sql, "SELECT * FROM login_tokens WHERE hash = ?", await sha256(input.token));
    if (!row || row.used_at !== null || row.expires_at <= now) return null;
  } else if (input.email && input.code) {
    const candidates = deps.sql.all<TokenRow>(
      "SELECT * FROM login_tokens WHERE email = ? AND purpose = 'login' AND used_at IS NULL AND expires_at > ? AND attempts < ? ORDER BY created_at DESC LIMIT 3",
      input.email,
      now,
      MAX_CODE_ATTEMPTS,
    );
    const wanted = await sha256(`${input.email}:${input.code}`);
    row = candidates.find((c) => c.code_hash !== null && safeEqual(c.code_hash, wanted)) ?? null;
    if (!row) {
      // un código errado gasta un intento de cada enlace vigente: no se puede adivinar probando
      for (const c of candidates) deps.sql.run("UPDATE login_tokens SET attempts = attempts + 1 WHERE hash = ?", c.hash);
      return null;
    }
  } else return null;

  deps.sql.run("UPDATE login_tokens SET used_at = ? WHERE hash = ?", now, row.hash);
  let user = one<User>(deps.sql, "SELECT * FROM users WHERE email = ?", row.email);
  const created = !user;
  if (!user) {
    deps.sql.run("INSERT INTO users (id, email, created_at, last_activity_at) VALUES (?, ?, ?, ?)", crypto.randomUUID(), row.email, now, now);
    user = one<User>(deps.sql, "SELECT * FROM users WHERE email = ?", row.email)!;
  }
  // las novedades comerciales se aceptan aparte: solo se anotan si la persona tildó la casilla
  if (row.marketing && !user.marketing) {
    deps.sql.run("UPDATE users SET marketing = 1, marketing_at = ? WHERE id = ?", now, user.id);
    user = { ...user, marketing: 1, marketing_at: now };
  }
  return { user, designId: row.design_id, created };
}

export async function openSession(deps: Deps, userId: string): Promise<string> {
  const token = randomToken();
  const now = deps.now();
  deps.sql.run("INSERT INTO sessions (hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", await sha256(token), userId, now, now + SESSION_TTL);
  return token;
}

export async function sessionUser(deps: Deps, request: Request): Promise<User | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const now = deps.now();
  const hash = await sha256(token);
  const session = one<{ user_id: string; expires_at: number }>(deps.sql, "SELECT user_id, expires_at FROM sessions WHERE hash = ?", hash);
  if (!session || session.expires_at <= now) return null;
  // la sesión se estira con el uso: vence a los 30 días de la última visita
  if (session.expires_at - now < SESSION_TTL - DAY) deps.sql.run("UPDATE sessions SET expires_at = ? WHERE hash = ?", now + SESSION_TTL, hash);
  return one<User>(deps.sql, "SELECT * FROM users WHERE id = ?", session.user_id);
}

export async function closeSession(deps: Deps, request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) deps.sql.run("DELETE FROM sessions WHERE hash = ?", await sha256(token));
}

export const isAdmin = (deps: Deps, user: User | null): boolean => !!user && deps.config.adminEmails.includes(user.email);

/** borra la cuenta y todo lo que colgaba de ella */
export function deleteUser(deps: Deps, user: User) {
  for (const table of ["sessions", "designs", "reminders", "push_subs", "notices"]) deps.sql.run(`DELETE FROM ${table} WHERE user_id = ?`, user.id);
  deps.sql.run("DELETE FROM login_tokens WHERE email = ?", user.email);
  deps.sql.run("DELETE FROM tenant_members WHERE email = ?", user.email);
  deps.sql.run("DELETE FROM users WHERE id = ?", user.id);
}
