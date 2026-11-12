"use client";

/**
 * La cuenta liviana: un email y nada más. Sirve para guardar los diseños en el
 * servidor y abrirlos desde otro dispositivo. Sin cuenta todo sigue andando en
 * este dispositivo.
 */

import { useEffect, useSyncExternalStore } from "react";

import { ApiError, api } from "./api.ts";
import { EMPTY_STATE } from "./designs.ts";
import { getDesigns, setDesigns } from "./designStore.ts";
import { mergeStates, type DesignState } from "./designs.ts";

export type Account = {
  email: string;
  isAdmin: boolean;
  prefs: { remindersEmail: boolean; remindersPush: boolean; marketing: boolean };
  tenants: { id: string; slug: string; name: string }[];
};

/** "desconocido": todavía no se le preguntó al servidor */
export type AccountState = { status: "desconocido" | "anonimo" | "activo"; account: Account | null };

const HINT = "medida.account";
const EVENT = "medida:account";
let state: AccountState = { status: "desconocido", account: null };
let loading: Promise<void> | null = null;

type Hint = { lastSyncAt: number | null };

function readHint(): Hint | null {
  try {
    const raw = localStorage.getItem(HINT);
    return raw ? (JSON.parse(raw) as Hint) : null;
  } catch {
    return null;
  }
}
function writeHint(hint: Hint | null) {
  try {
    if (hint) localStorage.setItem(HINT, JSON.stringify(hint));
    else localStorage.removeItem(HINT);
  } catch {
    // sin almacenamiento la sesión igual vive en su cookie
  }
}

function set(next: AccountState) {
  state = next;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

const SERVER_STATE: AccountState = { status: "desconocido", account: null };

/**
 * Pregunta al servidor quién está. Solo lo hace si este dispositivo recuerda
 * una sesión (o si se lo piden): quien nunca creó una cuenta no genera pedidos.
 */
export function loadAccount(force = false): Promise<void> {
  if (!force && !readHint()) {
    if (state.status === "desconocido") set({ status: "anonimo", account: null });
    return Promise.resolve();
  }
  loading ??= api<{ user: Account }>("/api/me")
    .then(({ user }) => set({ status: "activo", account: user }))
    .catch((error) => {
      // 401: la sesión venció. Otro error (sin conexión): no se sabe, se queda como estaba
      if (error instanceof ApiError && error.status === 401) writeHint(null);
      set({ status: "anonimo", account: null });
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

export function useAccount(): AccountState {
  const current = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
  useEffect(() => {
    if (state.status === "desconocido") void loadAccount();
  }, []);
  return current;
}

export const getAccount = () => state;

/** pide el enlace y el código de acceso para ese email */
export async function requestAccess(email: string, marketing: boolean): Promise<void> {
  await api("/api/auth/start", { body: { email, marketing } });
}

/** canjea el enlace o el código; devuelve el diseño al que apuntaba un recordatorio, si venía de uno */
export async function verifyAccess(input: { token: string } | { email: string; code: string }): Promise<{ designId: string | null }> {
  const { user, designId } = await api<{ user: Account; designId: string | null }>("/api/auth/verify", { body: input });
  writeHint({ lastSyncAt: null });
  set({ status: "activo", account: user });
  await syncDesigns();
  return { designId };
}

export async function updatePrefs(patch: Partial<Account["prefs"]>): Promise<void> {
  const { user } = await api<{ user: Account }>("/api/me", { method: "PATCH", body: patch });
  set({ status: "activo", account: user });
}

/** cierra la sesión. Si pudo dejar todo en la cuenta, saca los diseños de este dispositivo */
export async function signOut(): Promise<void> {
  const saved = await syncDesigns();
  await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => {});
  writeHint(null);
  if (saved) setDesigns(EMPTY_STATE);
  set({ status: "anonimo", account: null });
}

export async function deleteAccount(): Promise<void> {
  await api("/api/me", { method: "DELETE" });
  writeHint(null);
  set({ status: "anonimo", account: null });
}

// ------------------------------------------------------------ sincronización

let syncing: Promise<boolean> | null = null;

/** hay algo en este dispositivo que el servidor todavía no tiene */
export function hasPendingChanges(): boolean {
  const hint = readHint();
  if (!hint) return false;
  const local = getDesigns();
  return local.tombstones.length > 0 || local.designs.some((d) => hint.lastSyncAt === null || d.updatedAt >= hint.lastSyncAt);
}

/**
 * Junta los diseños de este dispositivo con los de la cuenta. Sube lo que
 * cambió acá, baja lo que cambió en otro lado; gana lo modificado más tarde.
 * Devuelve false si no hay cuenta o no se pudo.
 */
export function syncDesigns(): Promise<boolean> {
  const hint = readHint();
  if (!hint || state.status !== "activo") return Promise.resolve(false);
  syncing ??= (async () => {
    const startedAt = Date.now();
    const local = getDesigns();
    const upserts = local.designs.filter((d) => hint.lastSyncAt === null || d.updatedAt >= hint.lastSyncAt);
    try {
      const remote = await api<DesignState>("/api/designs/sync", { body: { upserts, deletes: local.tombstones } });
      // se vuelve a leer: la persona pudo cambiar algo mientras el pedido viajaba
      const merged = mergeStates(getDesigns(), { designs: remote.designs, tombstones: remote.tombstones });
      const next: DesignState = { designs: merged.designs, tombstones: [] };
      if (JSON.stringify(next) !== JSON.stringify(getDesigns())) setDesigns(next);
      writeHint({ lastSyncAt: startedAt });
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        writeHint(null);
        set({ status: "anonimo", account: null });
      }
      return false;
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}
