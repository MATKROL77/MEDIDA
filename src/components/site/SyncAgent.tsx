"use client";

import { useEffect } from "react";

import { hasPendingChanges, syncDesigns, useAccount } from "@/lib/account";

/**
 * Mantiene los diseños al día con la cuenta sin que la persona haga nada: al
 * abrir, al volver a la pestaña y un momento después de cada cambio. Sin
 * cuenta no hace ni un pedido.
 */
export function SyncAgent() {
  const { status } = useAccount();
  useEffect(() => {
    if (status !== "activo") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = 0;
    const pull = () => {
      // como mucho una vez cada medio minuto por volver a la pestaña
      if (document.visibilityState !== "visible" || Date.now() - last < 30_000) return;
      last = Date.now();
      void syncDesigns();
    };
    const push = () => {
      if (!hasPendingChanges()) return;
      clearTimeout(timer);
      timer = setTimeout(() => void syncDesigns(), 2000);
    };
    pull();
    window.addEventListener("medida:designs", push);
    document.addEventListener("visibilitychange", pull);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("medida:designs", push);
      document.removeEventListener("visibilitychange", pull);
    };
  }, [status]);
  return null;
}
