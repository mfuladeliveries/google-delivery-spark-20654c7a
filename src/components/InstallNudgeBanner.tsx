import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Download, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

const DISMISS_KEY = "mfula_install_nudge_dismissed";

const InstallNudgeBanner = () => {
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt({
    variant: "customer",
    applyOnMount: false,
  });
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result.outcome === "accepted") handleDismiss();
  };

  // Don't show if dismissed, already installed, or can't install
  if (dismissed || isInstalled || !canInstall) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-40 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-3 shadow-lg">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-foreground">Install Mfula App</p>
          <p className="text-[10px] text-muted-foreground truncate">
            Faster ordering & push notifications
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="btn-glow shrink-0 rounded-xl gradient-maroon px-3 py-1.5 text-[11px] font-bold text-primary-foreground active:scale-95 transition-transform"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-secondary transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default InstallNudgeBanner;
