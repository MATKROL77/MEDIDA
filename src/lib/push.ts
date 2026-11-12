"use client";

/**
 * Notificaciones del navegador. Solo se piden cuando la persona las activa, y
 * solo si el navegador las admite.
 */

import { api } from "./api.ts";

export type PushSupport = "ok" | "sin_soporte" | "ios_sin_instalar" | "bloqueadas";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "sin_soporte";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) {
    // en iPhone y iPad las notificaciones existen solo para sitios agregados a la pantalla de inicio
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return ios ? "ios_sin_instalar" : "sin_soporte";
  }
  return Notification.permission === "denied" ? "bloqueadas" : "ok";
}

function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const padded = key.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((key.length + 3) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** pide permiso, suscribe este navegador y lo registra en la cuenta */
export async function enablePush(): Promise<"ok" | "denegado" | "error"> {
  try {
    if ((await Notification.requestPermission()) !== "granted") return "denegado";
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const { key } = await api<{ key: string }>("/api/push/key");
    const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
    await api("/api/push/subscribe", { body: { endpoint: subscription.endpoint } });
    return "ok";
  } catch {
    return "error";
  }
}

export async function disablePush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    await api("/api/push/unsubscribe", { body: subscription ? { endpoint: subscription.endpoint } : {} });
    await subscription?.unsubscribe();
  } catch {
    // si no se pudo dar de baja acá, el servidor igual deja de avisar al apagar la preferencia
  }
}
