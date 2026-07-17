/* global self */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json() || {};
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visibleAdmin = windows.find(
        (client) =>
          client.visibilityState === "visible" && new URL(client.url).pathname.startsWith("/admin"),
      );

      if (visibleAdmin) {
        visibleAdmin.postMessage({ type: "NEW_ORDER_PUSH", payload });
        return;
      }

      await self.registration.showNotification(payload.title || "Nuevo pedido", {
        body: payload.body || "Ingreso un nuevo pedido web.",
        icon: "/pwa-icon-192.png",
        badge: "/pwa-icon-192.png",
        tag: payload.tag || `order-${payload.orderId || Date.now()}`,
        renotify: true,
        vibrate: [250, 100, 250],
        data: {
          orderId: payload.orderId,
          url: payload.url || "/admin/pedidos",
        },
      });

      if (self.navigator?.setAppBadge) await self.navigator.setAppBadge();
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/admin/pedidos", self.location.origin)
    .href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.navigate(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })(),
  );
});
