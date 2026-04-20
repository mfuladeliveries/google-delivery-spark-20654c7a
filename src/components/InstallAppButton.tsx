import { Download, Check } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import type { PwaVariant } from "@/lib/pwaVariant";
import { toast } from "sonner";

interface InstallAppButtonProps {
  variant: PwaVariant;
  label?: string;
  className?: string;
  compact?: boolean;
}

const InstallAppButton = ({ variant, label = "Install App", className = "", compact = false }: InstallAppButtonProps) => {
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt({ variant });

  if (isInstalled) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--driver-success)/0.1)] px-3 py-1.5 text-[11px] font-bold text-[hsl(var(--driver-success))] ${className}`}>
        <Check className="h-3 w-3" /> Installed
      </span>
    );
  }

  if (!canInstall) return null;

  const handleClick = async () => {
    const result = await promptInstall();
    if (result.outcome === "unsupported") {
      toast.info("To install, use your browser's menu → 'Add to Home Screen'");
    } else if (result.outcome === "dismissed") {
      toast.info("Install dismissed");
    } else if (result.outcome === "accepted") {
      toast.success("App installed!");
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition-colors active:scale-95 ${className}`}
      >
        <Download className="h-3 w-3" />
        Install
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors active:scale-95 ${className}`}
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
};

export default InstallAppButton;
