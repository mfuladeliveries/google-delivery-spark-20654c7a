import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Share,
  Plus,
  Check,
  ShoppingBag,
  Truck,
  Shield,
  ChefHat,
  Copy,
  Send,
} from "lucide-react";
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
    [variantParam],
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
                      {window.location.origin}
                      {app.installPath}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleInstall(app.variant)}
                  disabled={isInstalling || (isInstalled && !deferredPrompt)}
                  className="btn-glow mt-3 flex w-full items-center justify-center gap-2 rounded-xl gradient-maroon py-2.5 font-display text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
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
            <Link to="/install" className="text-xs font-bold text-primary hover:underline">
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
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    1
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tap the <Share className="inline h-3.5 w-3.5 text-primary" />{" "}
                    <strong>Share</strong> button in Safari
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    2
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scroll down and tap <Plus className="inline h-3.5 w-3.5 text-primary" />{" "}
                    <strong>Add to Home Screen</strong>
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    3
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tap <strong>Add</strong> to confirm.
                    {!focusedApp && " Tap your app variant above first to brand the icon."}
                  </p>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground italic">
                  iOS doesn't show our install button. Use Safari's Share menu after picking your
                  app variant above.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    1
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tap the <strong>⋮ menu</strong> in Chrome
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    2
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tap <strong>Install app</strong> or <strong>Add to Home Screen</strong>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Why install */}
        <div className="mt-6 space-y-3">
          <h3 className="font-bold text-xs text-foreground text-center uppercase tracking-wide">
            Why install?
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { emoji: "⚡", title: "Faster", desc: "Loads instantly" },
              { emoji: "📱", title: "Home Screen", desc: "One-tap access" },
              { emoji: "🔔", title: "Notifications", desc: "Order alerts" },
              { emoji: "📶", title: "Offline", desc: "Works offline" },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border bg-card p-2.5 text-center"
              >
                <span className="text-xl">{item.emoji}</span>
                <p className="mt-0.5 text-[11px] font-bold text-foreground">{item.title}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Driver-specific: full step-by-step + FAQ */}
        {focusedApp?.variant === "driver" && (
          <>
            <section className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-card">
              <h3 className="font-display text-base font-bold text-foreground">
                Step-by-step: install the Driver App
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Follow the steps for your phone. It takes less than a minute.
              </p>

              {/* Android steps */}
              <div className="mt-4">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                  📱 Android (Chrome)
                </div>
                <ol className="space-y-2.5">
                  {[
                    "Open this page in Chrome (not Facebook/WhatsApp browser).",
                    "Tap the orange Install Driver button above.",
                    "If a popup appears, tap Install or Add to Home Screen.",
                    "If no popup appears, tap the ⋮ menu (top-right) → Install app.",
                    "Find the Mfula Driver icon on your home screen and open it.",
                    "Sign in with your driver email and password to start delivering.",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                        {i + 1}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>

              {/* iOS steps */}
              <div className="mt-5 border-t border-border pt-4">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                  🍎 iPhone (Safari)
                </div>
                <ol className="space-y-2.5">
                  {[
                    "Open this page in Safari (other browsers don't support install on iOS).",
                    "Tap the Share icon at the bottom of Safari.",
                    "Scroll down and tap Add to Home Screen.",
                    "Tap Add in the top-right corner.",
                    "Find the Mfula Driver icon on your home screen and open it.",
                    "Sign in with your driver email and password to start delivering.",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                        {i + 1}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {/* FAQ */}
            <section className="mt-6">
              <h3 className="font-display text-base font-bold text-foreground mb-3">
                Frequently asked questions
              </h3>
              <div className="space-y-2">
                {[
                  {
                    q: "Is the Driver App free?",
                    a: "Yes — it's 100% free to install. You only need an internet connection (mobile data or Wi-Fi) to receive and deliver orders.",
                  },
                  {
                    q: "Do I need an account before installing?",
                    a: "No. You can install the app first. After opening it, sign in with your driver email and password. New drivers must be approved by an admin before going online.",
                  },
                  {
                    q: "Why don't I see an Install button?",
                    a: "On iPhone you must use Safari and add it via Share → Add to Home Screen. On Android, use Chrome — if you opened the link from Facebook or WhatsApp, tap ⋮ → Open in Chrome first.",
                  },
                  {
                    q: "Will the app use a lot of data?",
                    a: "No. The app is lightweight and only sends your GPS location while you're online with an active delivery (about every 10 seconds). Maps load on demand.",
                  },
                  {
                    q: "Will I receive notifications for new orders?",
                    a: "Yes. After installing, allow notifications when prompted. You'll get an alert and sound for every new order assigned to you.",
                  },
                  {
                    q: "How do I update the app?",
                    a: "Updates happen automatically. Just close and reopen the app — the latest version loads on the next cold start.",
                  },
                  {
                    q: "How do I uninstall?",
                    a: "Long-press the Mfula Driver icon on your home screen and tap Remove or Uninstall, just like any other app.",
                  },
                  {
                    q: "I'm stuck — who do I contact?",
                    a: "Contact the Admin on WhatsApp at +27 68 676 8409 for help with installation, login, or driver approval.",
                  },
                ].map((item, i) => (
                  <details
                    key={i}
                    className="group rounded-xl border border-border bg-card p-3 shadow-card open:bg-primary/5"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                      <span className="flex-1">{item.q}</span>
                      <span className="text-primary transition-transform group-open:rotate-45 text-lg leading-none">
                        +
                      </span>
                    </summary>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{item.a}</p>
                  </details>
                ))}
              </div>

              <a
                href="https://wa.me/27686768409"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 py-3 text-sm font-bold text-primary hover:bg-primary/10 transition-colors"
              >
                Still need help? Contact Admin on WhatsApp
              </a>
            </section>
          </>
        )}

        {/* Shareable install links — Driver & Customer */}
        <section className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-card">
          <h3 className="font-display text-base font-bold text-foreground">Share install links</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Send these links to drivers or customers so they can install the right app.
          </p>

          <div className="mt-4 space-y-3">
            {[
              {
                label: "Driver App",
                tagline: "For drivers — accept & deliver orders",
                icon: Truck,
                path: "/install/driver",
              },
              {
                label: "Customer App",
                tagline: "For customers — order food & track delivery",
                icon: ShoppingBag,
                path: "/install/customer",
              },
            ].map((item) => {
              const url = `${window.location.origin}${item.path}`;
              const Icon = item.icon;
              return (
                <div key={item.path} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.tagline}</p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
                    <code className="flex-1 truncate text-[11px] text-muted-foreground">{url}</code>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(url);
                          toast.success(`${item.label} link copied`);
                        } catch {
                          toast.error("Could not copy link");
                        }
                      }}
                      aria-label={`Copy ${item.label} link`}
                      className="shrink-0 rounded-md p-1.5 text-primary hover:bg-primary/10"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Install the Mfula ${item.label}: ${url}`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-glow flex items-center justify-center gap-1.5 rounded-lg gradient-maroon py-2 text-xs font-bold text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[0.98]"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Share on WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        const shareData = {
                          title: `Mfula ${item.label}`,
                          text: `Install the Mfula ${item.label}`,
                          url,
                        };
                        if (navigator.share) {
                          try {
                            await navigator.share(shareData);
                          } catch {
                            /* user cancelled */
                          }
                        } else {
                          try {
                            await navigator.clipboard.writeText(url);
                            toast.success("Link copied — paste anywhere to share");
                          } catch {
                            toast.error("Sharing not supported");
                          }
                        }
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-bold text-foreground hover:bg-secondary"
                    >
                      <Share className="h-3.5 w-3.5" />
                      Share…
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <p className="mt-6 text-center text-[10px] text-muted-foreground px-4">
          Each app installs as a separate icon with its own scope. Customer opens on the food menu,
          Driver opens on the dashboard, Restaurant opens on the orders board, and Admin opens on
          the admin console.
        </p>
      </main>
    </div>
  );
};

export default Install;
