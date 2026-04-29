import { Link } from "react-router-dom";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISS_KEY = "mfula_driver_install_banner_dismissed";

const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
};

const isPreviewOrIframe = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  return host.includes("id-preview--") || host.includes("lovableproject.com");
};

/**
 * Banner shown on /driver/auth that nudges drivers to install the dedicated
 * Driver app from /install/driver. Hidden when:
 *  - Already running as installed PWA
 *  - User explicitly dismissed it
 *  - Inside Lovable preview/iframe (no real install possible)
 */
const DriverInstallBanner = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (isPreviewOrIframe()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 shadow-card">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
        <Download className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">Install the Driver App</p>
        <p className="text-xs text-muted-foreground">
          One-tap access from your home screen, with order alerts.
        </p>
      </div>
      <Link
        to="/install/driver"
        className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        Install
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install banner"
        className="ml-1 shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-secondary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default DriverInstallBanner;
