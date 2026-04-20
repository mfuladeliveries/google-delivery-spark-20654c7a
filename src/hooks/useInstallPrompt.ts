import { useState, useEffect, useCallback } from "react";
import { setPwaVariant, type PwaVariant } from "@/lib/pwaVariant";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface UseInstallPromptOptions {
  variant: PwaVariant;
  /** Whether to apply the manifest variant on mount (default: true) */
  applyOnMount?: boolean;
}

export const useInstallPrompt = ({ variant, applyOnMount = true }: UseInstallPromptOptions) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (applyOnMount) setPwaVariant(variant);

    if (typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setIsInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, [variant, applyOnMount]);

  const promptInstall = useCallback(async () => {
    // Always re-apply the manifest right before prompting so the browser
    // picks up the variant the user actually chose.
    setPwaVariant(variant);
    if (!deferredPrompt) return { outcome: "unsupported" as const };
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
    return { outcome };
  }, [deferredPrompt, variant]);

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    promptInstall,
  };
};
