/*
 * Notificaciones de MEDIDA. El aviso llega sin contenido: el texto se le pide
 * al servidor con la sesión de la persona, así no pasa por terceros.
 */
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let notice = null;
      try {
        const res = await fetch("/api/push/notice", { credentials: "same-origin" });
        notice = (await res.json()).notice;
      } catch {
        // sin conexión se muestra el aviso genérico
      }
      await self.registration.showNotification(notice?.title ?? "Tu diseño sigue guardado en MEDIDA", {
        body: notice?.body ?? "Podés seguir editándolo cuando quieras.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "medida-recordatorio",
        data: { url: notice?.url ?? "/mis-disenos/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/mis-disenos/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => "focus" in w);
      if (open) {
        await open.focus();
        return open.navigate(url);
      }
      return self.clients.openWindow(url);
    })(),
  );
});
