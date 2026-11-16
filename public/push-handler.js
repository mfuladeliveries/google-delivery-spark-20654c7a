// Push notification handler for service worker
// Long, repeating vibration so a driver's phone keeps buzzing
// even when the app is fully closed (background push).
const DRIVER_ALERT_VIBRATION = [
  800, 300, 800, 300, 800, 300, 800, 300, 800, 300, 800, 300, 800, 300, 800,
];
const DEFAULT_VIBRATION = [400, 200, 400, 200, 400];

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const { title, body, icon, badge, data: notifData } = data;
    const isCustomerArrival = notifData?.kind === "customer_arrived";

    // Driver-bound pushes (new offers, broadcasts) get the louder pattern.
    const url = notifData?.url || "";
    const kind = notifData?.kind || "";
    const isDriverAlert =
      url.startsWith("/driver") ||
      kind === "offer" ||
      kind === "missed" ||
      (typeof title === "string" && /delivery|order offer/i.test(title));

    event.waitUntil(
      (async () => {
      const clients = isCustomerArrival
        ? await self.clients.matchAll({ type: "window", includeUncontrolled: true })
        : [];
      const visibleClients = clients.filter((client) => client.visibilityState === "visible");
      for (const client of visibleClients) client.postMessage({ type: "customer-arrival", ...notifData });
      return self.registration.showNotification(title || "Mfula Deliveries", {
        body: body || "",
        icon: icon || "/notification-logo.png",
        badge: badge || "/favicon.ico",
        vibrate: isDriverAlert ? DRIVER_ALERT_VIBRATION : DEFAULT_VIBRATION,
        tag: isCustomerArrival ? data.tag || `arrival-${notifData?.order_id}` : `order-${notifData?.order_number || "general"}`,
        renotify: false,
        requireInteraction: true,
        // Custom ringing is possible in an open app; closed-app sound is controlled by the phone.
        silent: isCustomerArrival ? visibleClients.length > 0 : true,
        data: notifData,
      });
      })()
    );
  } catch {
    // Fallback for non-JSON payloads
    event.waitUntil(
      self.registration.showNotification("Mfula Deliveries", {
        body: event.data.text(),
        icon: "/notification-logo.png",
        vibrate: DEFAULT_VIBRATION,
        requireInteraction: true,
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
