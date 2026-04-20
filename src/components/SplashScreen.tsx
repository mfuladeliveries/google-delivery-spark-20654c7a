import { useEffect, useState } from "react";
import { storeInfo } from "@/data/menu";

const SESSION_KEY = "mfula_splash_shown";

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
};

/**
 * Native-feel splash screen shown for ~1s on cold launch of the installed PWA.
 * - Only shows in standalone mode (installed app)
 * - Once per session (so it doesn't reappear on in-app navigation)
 */
const SplashScreen = () => {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!isStandalone()) return false;
    if (sessionStorage.getItem(SESSION_KEY) === "1") return false;
    return true;
  });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!show) return;
    sessionStorage.setItem(SESSION_KEY, "1");

    const fadeT = window.setTimeout(() => setFading(true), 800);
    const hideT = window.setTimeout(() => setShow(false), 1100);
    return () => {
      window.clearTimeout(fadeT);
      window.clearTimeout(hideT);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-primary transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-label="Loading Mfula Deliveries"
    >
      <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="rounded-3xl bg-primary-foreground/10 p-4 ring-4 ring-primary-foreground/20 backdrop-blur-sm">
          <img
            src={storeInfo.logo}
            alt={storeInfo.name}
            className="h-24 w-24 rounded-2xl object-cover"
          />
        </div>
        <h1 className="font-display text-2xl font-bold text-primary-foreground tracking-tight">
          Mfula Deliveries
        </h1>
        <div className="mt-2 flex gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/80 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/80 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/80 animate-bounce" />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
