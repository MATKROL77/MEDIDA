/**
 * Notificaciones del navegador (Web Push).
 *
 * El servidor firma cada aviso con su par de claves (VAPID), que genera la
 * primera vez y guarda en su base. El aviso viaja sin contenido: al llegar, el
 * navegador le pregunta al servidor qué mostrar, con la sesión de la persona.
 * Así no pasa ningún texto por los servidores de terceros.
 */

import { fromBase64Url, toBase64Url } from "./crypto.ts";
import { one, type Sql } from "./sql.ts";

/** servicios de notificaciones de los navegadores: no se le manda nada a otro destino */
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];

export function validEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && PUSH_HOSTS.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
}

export type VapidKeys = { publicKey: string; privateJwk: JsonWebKey };

export async function vapidKeys(sql: Sql): Promise<VapidKeys> {
  const saved = one<{ value: string }>(sql, "SELECT value FROM meta WHERE key = 'vapid'");
  if (saved) return JSON.parse(saved.value) as VapidKeys;
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const keys: VapidKeys = {
    publicKey: toBase64Url(new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer)),
    privateJwk: (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey,
  };
  sql.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('vapid', ?)", JSON.stringify(keys));
  return keys;
}

const encode = (data: unknown) => toBase64Url(new TextEncoder().encode(JSON.stringify(data)));

/** el pedido que se le hace al servicio de notificaciones para despertar a un navegador */
export async function pushRequest(endpoint: string, keys: VapidKeys, contact: string, now: number): Promise<{ url: string; headers: Record<string, string> }> {
  const key = await crypto.subtle.importKey("jwk", keys.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const unsigned = `${encode({ typ: "JWT", alg: "ES256" })}.${encode({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: `mailto:${contact}` })}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  return {
    url: endpoint,
    headers: { authorization: `vapid t=${unsigned}.${toBase64Url(new Uint8Array(signature))}, k=${keys.publicKey}`, ttl: "86400", urgency: "normal", "content-length": "0" },
  };
}

/** para las pruebas: comprueba que la firma del pedido sea de la clave pública que se publica */
export async function verifyPushRequest(headers: Record<string, string>): Promise<boolean> {
  const match = /^vapid t=([^.]+\.[^.]+)\.([^,]+), k=(.+)$/.exec(headers.authorization ?? "");
  if (!match) return false;
  const key = await crypto.subtle.importKey("raw", fromBase64Url(match[3]), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromBase64Url(match[2]), new TextEncoder().encode(match[1]));
}
