import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Share, Plus } from "lucide-react";
import { storeInfo } from "@/data/menu";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl shadow-card">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link to="/" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-bold text-base text-foreground">Install App</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-8">
        <div className="text-center mb-8">
          <img
            src={storeInfo.logo}
            alt={storeInfo.name}
            className="mx-auto h-20 w-20 rounded-2xl object-cover ring-2 ring-primary/30 shadow-orange"
          />
          <h2 className="mt-4 font-display text-2xl font-bold text-foreground">{storeInfo.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Install our app for faster ordering & notifications
          </p>
        </div>

        {isInstalled ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-bold text-foreground">Already Installed!</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You're all set. Open the app from your home screen.
            </p>
          </div>
        ) : deferredPrompt ? (
          <div className="space-y-4">
            <button
              onClick={handleInstall}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-display font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="h-5 w-5" />
              Install App
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Installs instantly. No app store needed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {isIOS ? (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <h3 className="font-bold text-foreground text-center">Install on iPhone</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</div>
                    <p className="text-sm text-muted-foreground">
                      Tap the <Share className="inline h-4 w-4 text-primary" /> <strong>Share</strong> button in Safari's toolbar
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</div>
                    <p className="text-sm text-muted-foreground">
                      Scroll down and tap <Plus className="inline h-4 w-4 text-primary" /> <strong>Add to Home Screen</strong>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</div>
                    <p className="text-sm text-muted-foreground">
                      Tap <strong>Add</strong> to confirm
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <h3 className="font-bold text-foreground text-center">Install on Android</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</div>
                    <p className="text-sm text-muted-foreground">
                      Tap the <strong>⋮ menu</strong> in your browser
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</div>
                    <p className="text-sm text-muted-foreground">
                      Tap <strong>Add to Home Screen</strong> or <strong>Install App</strong>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</div>
                    <p className="text-sm text-muted-foreground">
                      Tap <strong>Install</strong> to confirm
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 space-y-3">
          <h3 className="font-bold text-sm text-foreground text-center">Why install?</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { emoji: "⚡", title: "Faster", desc: "Loads instantly" },
              { emoji: "📱", title: "Home Screen", desc: "One-tap access" },
              { emoji: "🔔", title: "Notifications", desc: "Order updates" },
              { emoji: "📶", title: "Offline", desc: "Browse menu offline" },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-3 text-center">
                <span className="text-2xl">{item.emoji}</span>
                <p className="mt-1 text-xs font-bold text-foreground">{item.title}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Install;
