import { Link } from "react-router-dom";
import { ArrowLeft, Truck, Power, Wifi, WifiOff } from "lucide-react";

interface DriverHeaderProps {
  isOnline: boolean;
  togglingOnline: boolean;
  onToggleOnline: () => void;
}

const DriverHeader = ({ isOnline, togglingOnline, onToggleOnline }: DriverHeaderProps) => {
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
              <h1 className="font-bold text-foreground">Driver Portal</h1>
              <p className="text-[11px] text-muted-foreground font-medium">Mfula Deliveries</p>
            </div>
          </div>
        </div>

        <button
          onClick={onToggleOnline}
          disabled={togglingOnline}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-95 ${
            isOnline
              ? "bg-[hsl(var(--driver-success)/0.1)] text-[hsl(var(--driver-success))] border-2 border-[hsl(var(--driver-success)/0.3)]"
              : "bg-destructive/10 text-destructive border-2 border-destructive/30"
          }`}
        >
          {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {togglingOnline ? "..." : isOnline ? "Online" : "Offline"}
        </button>
      </div>
    </header>
  );
};

export default DriverHeader;
