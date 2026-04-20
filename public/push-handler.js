// Push notification handler for service worker
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const { title, body, icon, badge, data: notifData } = data;

    event.waitUntil(
      self.registration.showNotification(title || "Mfula Deliveries", {
        body: body || "",
        icon: icon || "/pwa-192x192.png",
        badge: badge || "/favicon.ico",
        vibrate: [400, 200, 400, 200, 400, 200, 400],
        sound: "/sounds/new-order.mp3",
        tag: `order-${notifData?.order_number || "general"}`,
        renotify: true,
        requireInteraction: true,
        silent: false,
        data: notifData,
      })
    );
  } catch {
    // Fallback for non-JSON payloads
    event.waitUntil(
      self.registration.showNotification("Mfula Deliveries", {
        body: event.data.text(),
        icon: "/pwa-192x192.png",
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus existing window if available
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window
        return self.clients.openWindow(url);
      })
  );
});
