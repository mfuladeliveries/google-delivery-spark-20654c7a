import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MapPin, Store, Clock, Package, Check, X } from "lucide-react";
import { driverPayoutForFee, zoneIdForFee } from "@/lib/zones";

interface NewOrderOffer {
  id: string;
  order_number: number;
  restaurant: string;
  customer_address: string;
  total: number;
  delivery_fee: number;
  items: any[];
  created_at: string;
  customer_name?: string;
  offer_expires_at?: string | null;
}

interface NewOrderModalProps {
  open: boolean;
  offer: NewOrderOffer | null;
  distanceKm: number | null;
  accepting: boolean;
  rejecting: boolean;
  onAccept: () => void;
  onReject: () => void;
}

const NewOrderModal = ({ open, offer, distanceKm, accepting, rejecting, onAccept, onReject }: NewOrderModalProps) => {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!offer?.offer_expires_at) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(offer.offer_expires_at!).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [offer?.offer_expires_at, offer?.id]);

  if (!offer) return null;
  const minutesAgo = Math.max(0, Math.floor((Date.now() - new Date(offer.created_at).getTime()) / 60000));

  // Countdown ring math (5 min = 300s default)
  const totalSeconds = 300;
  const progress = secondsLeft !== null ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 1;
  const mm = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0;
  const ss = secondsLeft !== null ? secondsLeft % 60 : 0;
  const countdownLabel = secondsLeft !== null ? `${mm}:${ss.toString().padStart(2, "0")}` : "";
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <Dialog open={open} onOpenChange={() => { /* must Accept or Reject */ }}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border-2 border-primary max-h-[90vh] flex flex-col gap-0 top-[5vh] translate-y-0 sm:top-[50%] sm:translate-y-[-50%]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header with countdown */}
        <div className="bg-primary px-5 py-3 text-primary-foreground shrink-0 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Package className="h-5 w-5" />
              <h2 className="text-base font-bold">New Delivery Request</h2>
            </div>
            <p className="text-xs opacity-90">Order #{offer.order_number} • {minutesAgo}m ago</p>
          </div>
          {secondsLeft !== null && (
            <div className="relative h-12 w-12 shrink-0">
              <svg className="h-12 w-12 -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r={radius} fill="none" stroke="hsl(var(--primary-foreground) / 0.25)" strokeWidth="4" />
                <circle
                  cx="22"
                  cy="22"
                  r={radius}
                  fill="none"
                  stroke="hsl(var(--primary-foreground))"
                  strokeWidth="4"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 250ms linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums">
                {countdownLabel}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
          <div className="flex items-center justify-between rounded-xl bg-[hsl(var(--driver-success)/0.08)] border border-[hsl(var(--driver-success)/0.2)] px-4 py-3">
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">You'll earn</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-[hsl(var(--driver-success))]">R{driverPayoutForFee(offer.delivery_fee)}</p>
                {zoneIdForFee(offer.delivery_fee) && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    Zone {zoneIdForFee(offer.delivery_fee)}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Customer pays R{offer.delivery_fee} delivery
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Order value</p>
              <p className="text-lg font-bold text-foreground">R{offer.total}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <Store className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Pickup</p>
              <p className="text-sm font-semibold text-foreground truncate">{offer.restaurant}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--driver-info)/0.1)] shrink-0">
              <MapPin className="h-4 w-4 text-[hsl(var(--driver-info))]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Delivery</p>
              <p className="text-sm font-semibold text-foreground truncate">{offer.customer_address}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs border-t border-border pt-3">
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {distanceKm !== null ? `${distanceKm.toFixed(1)} km away` : "Distance unknown"}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {minutesAgo}m old
            </span>
            <span className="ml-auto text-muted-foreground">{offer.items.length} items</span>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 p-4 bg-secondary/30 border-t border-border shrink-0">
          <button
            onClick={onReject}
            disabled={accepting || rejecting}
            className="rounded-xl border-2 border-destructive/30 bg-card py-3.5 text-sm font-bold text-destructive disabled:opacity-50 transition-all hover:bg-destructive/5 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <X className="h-4 w-4" />
            {rejecting ? "Declining..." : "Decline"}
          </button>
          <button
            onClick={onAccept}
            disabled={accepting || rejecting}
            className="rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50 transition-all hover:opacity-95 active:scale-[0.98] shadow-orange flex items-center justify-center gap-2"
          >
            <Check className="h-4 w-4" />
            {accepting ? "Accepting..." : "Accept"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewOrderModal;
