import { Link } from "react-router-dom";
import { ArrowLeft, Truck, Wifi, WifiOff, User, Bell } from "lucide-react";

interface DriverHeaderProps {
  isOnline: boolean;
  togglingOnline: boolean;
  onToggleOnline: () => void;
  activeCount?: number;
  onProfileClick?: () => void;
}

const DriverHeader = ({ isOnline, togglingOnline, onToggleOnline, activeCount = 0, onProfileClick }: DriverHeaderProps) => {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl shadow-card">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="rounded-xl p-2 text-muted-foreground hover:bg-secondary transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-foreground text-sm">Mfula Driver</h1>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${isOnline ? "bg-[hsl(var(--driver-success))] animate-pulse" : "bg-muted-foreground"}`} />
                <p className="text-[11px] text-muted-foreground font-medium">{isOnline ? "Online" : "Offline"}</p>
                {activeCount > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    {activeCount} active
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onProfileClick}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary transition-colors"
          >
            <User className="h-5 w-5" />
          </button>

          <button
            onClick={onToggleOnline}
            disabled={togglingOnline}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all active:scale-95 ${
              isOnline
                ? "bg-[hsl(var(--driver-success)/0.1)] text-[hsl(var(--driver-success))] border-2 border-[hsl(var(--driver-success)/0.3)]"
                : "bg-destructive/10 text-destructive border-2 border-destructive/30"
            }`}
          >
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {togglingOnline ? "..." : isOnline ? "Online" : "Offline"}
          </button>
        </div>
      </div>
    </header>
  );
};

export default DriverHeader;
