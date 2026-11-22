import { useEffect, useState } from "react";

/** Lifecycle signal for conditional polling and screen-only realtime reloads. */
export function usePageActive() {
  const [active, setActive] = useState(() => !document.hidden && navigator.onLine);
  useEffect(() => {
    const sync = () => setActive(!document.hidden && navigator.onLine);
    const hide = () => setActive(false);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", sync);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    sync();
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return active;
}