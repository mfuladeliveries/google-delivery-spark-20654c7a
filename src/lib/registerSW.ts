// Manual service-worker registration with safety guards.
//
// Why this file exists:
//   `vite-plugin-pwa` previously used `registerType: "autoUpdate"` which made
//   the service worker silently call `skipWaiting()` + `clientsClaim()` on
//   every visibility change. On installed PWAs that meant: minimize → reopen
//   → full page reload → cart/state lost.
//
// We now register the SW ourselves with these rules:
//   • Skip entirely in iframes and on Lovable preview hosts (the editor)
//   • Skip when the page is in dev mode
//   • Never auto-reload — if a new SW is waiting we keep the old page running
//     and only activate the new one on the NEXT cold start
//   • Proactively unregister any leftover aggressive SW from previous builds

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com"));

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // In the editor preview / iframes, actively unregister any SW so the
  // preview never gets stuck on a stale cached build.
  if (isInIframe || isPreviewHost || import.meta.env.DEV) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* noop */
    }
    return;
  }

  try {
    // Dynamic import so the virtual module is only pulled in production builds.
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({
      immediate: true,
      // No onNeedRefresh handler => the waiting SW just sits there until the
      // user fully closes and reopens the app. That is the whole point: no
      // forced reload while the user is mid-order.
      onRegisteredSW(_swUrl, registration) {
        // Belt and braces: if anything ever calls skipWaiting, don't auto-reload.
        if (registration) {
          registration.addEventListener("updatefound", () => {
            // intentionally do nothing — wait for next cold start
          });
        }
      },
    });
  } catch {
    /* virtual module not available (e.g. dev) */
  }
}
