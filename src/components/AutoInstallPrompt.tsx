import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import type { PwaVariant } from "@/lib/pwaVariant";
import { toast } from "sonner";

interface AutoInstallPromptProps {
  variant: PwaVariant;
  /** Delay in ms before showing the popup. Default 3000. */
  delayMs?: number;
  /** App display name shown in popup. Defaults to "Mfula App". */
  appName?: string;
}

const SESSION_DISMISS_KEY = "mfula_install_prompt_dismissed_session";

const isIOSDevice = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as { MSStream?: unknown }).MSStream;
};

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
};

/**
 * Auto-shows an install prompt 3s after mount.
 * - Android/Chrome: native beforeinstallprompt popup
 * - iOS Safari: bottom banner with Share → Add to Home Screen guide
 * - Hidden when already installed (standalone) or dismissed this session
 */
const AutoInstallPrompt = ({ variant, delayMs = 3000, appName = "Mfula App" }: AutoInstallPromptProps) => {
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt({ variant, applyOnMount: true });
  const [show, setShow] = useState(false);
  const [iosShow, setIosShow] = useState(false);
  const [iOS, setIOS] = useState(false);

  useEffect(() => {
    // Skip entirely if already installed
    if (isStandalone()) return;
    // Skip if dismissed this session
    if (sessionStorage.getItem(SESSION_DISMISS_KEY) === "1") return;

    const ios = isIOSDevice();
    setIOS(ios);

    const t = window.setTimeout(() => {
      if (sessionStorage.getItem(SESSION_DISMISS_KEY) === "1") return;
      if (ios) {
        setIosShow(true);
      } else {
        setShow(true);
      }
    }, delayMs);

    return () => window.clearTimeout(t);
  }, [delayMs]);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    setShow(false);
    setIosShow(false);
  };

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result.outcome === "accepted") {
      toast.success("App installed!");
      dismiss();
    } else if (result.outcome === "dismissed") {
      dismiss();
    } else if (result.outcome === "unsupported") {
      toast.info("Use your browser menu → 'Add to Home Screen'");
      dismiss();
    }
  };

  if (isInstalled || isStandalone()) return null;

  // iOS banner
  if (iOS && iosShow) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[60] animate-in slide-in-from-bottom duration-300 px-3 pb-3 pointer-events-none">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card/98 backdrop-blur-xl p-4 shadow-2xl pointer-events-auto">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-foreground">Install {appName}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Tap <Share className="inline h-3.5 w-3.5 text-primary mx-0.5" /> <strong>Share</strong> below, then{" "}
                <Plus className="inline h-3.5 w-3.5 text-primary mx-0.5" /> <strong>Add to Home Screen</strong>
              </p>
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-secondary"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Look for</span>
            <Share className="h-3.5 w-3.5 text-primary" />
            <span>at the bottom of Safari ↓</span>
          </div>
          <button
            onClick={dismiss}
            className="mt-3 w-full rounded-xl bg-secondary py-2 text-xs font-bold text-foreground active:scale-95 transition-transform"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  // Android / desktop popup
  if (show && canInstall) {
    return (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-3 bg-foreground/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display font-bold text-base text-foreground">Install {appName}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Faster ordering, push notifications, and one-tap access from your home screen.
              </p>
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-secondary"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={dismiss}
              className="rounded-xl bg-secondary py-2.5 text-xs font-bold text-foreground active:scale-95 transition-transform"
            >
              Not now
            </button>
            <button
              onClick={handleInstall}
              className="btn-glow rounded-xl gradient-maroon py-2.5 text-xs font-bold text-primary-foreground active:scale-95 transition-transform flex items-center justify-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Install Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AutoInstallPrompt;
