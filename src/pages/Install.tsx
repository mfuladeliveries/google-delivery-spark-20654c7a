import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Share, Plus, Check, ShoppingBag, Truck, Shield, ChefHat } from "lucide-react";
import { setPwaVariant, type PwaVariant } from "@/lib/pwaVariant";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface RoleApp {
  variant: PwaVariant;
  name: string;
  shortName: string;
  tagline: string;
  icon: typeof ShoppingBag;
  iconImg: string;
  ringClass: string;
  installPath: string;
}

const APPS: RoleApp[] = [
  {
    variant: "customer",
    name: "Mfula Customer",
    shortName: "Customer",
    tagline: "Order food, track delivery",
    icon: ShoppingBag,
    iconImg: "/pwa-customer-512.png",
    ringClass: "ring-primary/30",
    installPath: "/install/customer",
  },
  {
    variant: "driver",
    name: "Mfula Driver",
    shortName: "Driver",
    tagline: "Accept & deliver orders",
    icon: Truck,
    iconImg: "/pwa-driver-512.png",
    ringClass: "ring-primary/30",
    installPath: "/install/driver",
  },
  {
    variant: "restaurant",
    name: "Mfula Restaurant",
    shortName: "Restaurant",
    tagline: "Manage orders & menu",
    icon: ChefHat,
    iconImg: "/pwa-restaurant-512.png",
    ringClass: "ring-primary/30",
    installPath: "/install/restaurant",
  },
  {
    variant: "admin",
    name: "Mfula Admin",
    shortName: "Admin",
    tagline: "Manage orders, users, drivers",
    icon: Shield,
    iconImg: "/pwa-admin-512.png",
    ringClass: "ring-foreground/20",
    installPath: "/install/admin",
  },
];

const Install = () => {
  const { variant: variantParam } = useParams<{ variant?: string }>();
  const focusedApp = useMemo(
    () => APPS.find((a) => a.variant === variantParam) ?? null,
    [variantParam]
  );
  const visibleApps = focusedApp ? [focusedApp] : APPS;

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installingVariant, setInstallingVariant] = useState<PwaVariant | null>(null);

  // Apply the variant manifest immediately when landing on a focused install URL
  useEffect(() => {
    if (focusedApp) setPwaVariant(focusedApp.variant);
  }, [focusedApp]);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as { MSStream?: unknown }).MSStream);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setIsInstalled(true);
      toast.success("App installed to your home screen!");
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async (variant: PwaVariant) => {
    setInstallingVariant(variant);
    setPwaVariant(variant);

    if (!deferredPrompt) {
      toast.info("Use your browser menu → 'Add to Home Screen' to install");
      setInstallingVariant(null);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setIsInstalled(true);
      setDeferredPrompt(null);
    } catch {
      // user dismissed
    }
    setInstallingVariant(null);
  };

  const headerTitle = focusedApp ? `Install ${focusedApp.name}` : "Install Mfula App";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl shadow-card">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link to="/" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-bold text-base text-foreground">{headerTitle}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        <div className="text-center mb-6">
          <h2 className="font-display text-xl font-bold text-foreground">
            {focusedApp ? `Install ${focusedApp.shortName}` : "Choose your app"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {focusedApp
              ? `Install the ${focusedApp.name} app on your device.`
              : "Mfula has four apps. Pick the one for your role — each installs separately."}
          </p>
        </div>

        {/* Role apps */}
        <div className="space-y-3">
          {visibleApps.map((app) => {
            const isInstalling = installingVariant === app.variant;
            return (
              <div
                key={app.variant}
                className="rounded-2xl border border-border bg-card p-4 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={app.iconImg}
                    alt={app.name}
                    width={64}
                    height={64}
                    loading="lazy"
                    className={`h-16 w-16 shrink-0 rounded-2xl object-cover ring-2 ${app.ringClass}`}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-foreground text-sm truncate">{app.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{app.tagline}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/80 truncate">
                      {window.location.origin}{app.installPath}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleInstall(app.variant)}
                  disabled={isInstalling || (isInstalled && !deferredPrompt)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 font-display text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isInstalled && !deferredPrompt ? (
                    <>
                      <Check className="h-4 w-4" /> Already Installed
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      {isInstalling ? "Installing…" : `Install ${app.shortName}`}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {focusedApp && (
          <div className="mt-4 text-center">
            <Link
              to="/install"
              className="text-xs font-bold text-primary hover:underline"
            >
              ← See all Mfula apps
            </Link>
          </div>
        )}

        {/* Manual install instructions for iOS / when prompt unavailable */}
        {(!deferredPrompt || isIOS) && !isInstalled && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-4 space-y-3">
            <h3 className="font-bold text-sm text-foreground text-center">
              {isIOS ? "Install on iPhone" : "Manual install"}
            </h3>
            {isIOS ? (
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">1</div>
                  <p className="text-xs text-muted-foreground">
                    Tap the <Share className="inline h-3.5 w-3.5 text-primary" /> <strong>Share</strong> button in Safari
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">2</div>
                  <p className="text-xs text-muted-foreground">
                    Scroll down and tap <Plus className="inline h-3.5 w-3.5 text-primary" /> <strong>Add to Home Screen</strong>
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">3</div>
                  <p className="text-xs text-muted-foreground">
                    Tap <strong>Add</strong> to confirm.
                    {!focusedApp && " Tap your app variant above first to brand the icon."}
                  </p>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground italic">
                  iOS doesn't show our install button. Use Safari's Share menu after picking your app variant above.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">1</div>
                  <p className="text-xs text-muted-foreground">Tap the <strong>⋮ menu</strong> in Chrome</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">2</div>
                  <p className="text-xs text-muted-foreground">Tap <strong>Install app</strong> or <strong>Add to Home Screen</strong></p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Why install */}
        <div className="mt-6 space-y-3">
          <h3 className="font-bold text-xs text-foreground text-center uppercase tracking-wide">Why install?</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { emoji: "⚡", title: "Faster", desc: "Loads instantly" },
              { emoji: "📱", title: "Home Screen", desc: "One-tap access" },
              { emoji: "🔔", title: "Notifications", desc: "Order alerts" },
              { emoji: "📶", title: "Offline", desc: "Works offline" },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-2.5 text-center">
                <span className="text-xl">{item.emoji}</span>
                <p className="mt-0.5 text-[11px] font-bold text-foreground">{item.title}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] text-muted-foreground px-4">
          Each app installs as a separate icon with its own scope. Customer opens on the food menu, Driver opens on the dashboard, Restaurant opens on the orders board, and Admin opens on the admin console.
        </p>
      </main>
    </div>
  );
};

export default Install;
