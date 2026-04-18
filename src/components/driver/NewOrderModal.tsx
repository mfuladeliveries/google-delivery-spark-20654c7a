import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MapPin, Store, User, Clock, Package, Check, X } from "lucide-react";

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
  if (!offer) return null;
  const minutesAgo = Math.max(0, Math.floor((Date.now() - new Date(offer.created_at).getTime()) / 60000));

  return (
    <Dialog open={open} onOpenChange={() => { /* no-op: must Accept or Reject */ }}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border-2 border-primary"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-5 w-5" />
            <h2 className="text-lg font-bold">New Delivery Request</h2>
          </div>
          <p className="text-xs opacity-90">Order #{offer.order_number} • {minutesAgo}m ago</p>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Earnings */}
          <div className="flex items-center justify-between rounded-xl bg-[hsl(var(--driver-success)/0.08)] border border-[hsl(var(--driver-success)/0.2)] px-4 py-3">
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">You'll earn</p>
              <p className="text-2xl font-bold text-[hsl(var(--driver-success))]">R{offer.delivery_fee}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Order value</p>
              <p className="text-lg font-bold text-foreground">R{offer.total}</p>
            </div>
          </div>

          {/* Pickup */}
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <Store className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Pickup</p>
              <p className="text-sm font-semibold text-foreground truncate">{offer.restaurant}</p>
            </div>
          </div>

          {/* Delivery */}
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--driver-info)/0.1)] shrink-0">
              <MapPin className="h-4 w-4 text-[hsl(var(--driver-info))]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Delivery</p>
              <p className="text-sm font-semibold text-foreground truncate">{offer.customer_address}</p>
            </div>
          </div>

          {/* Distance + items */}
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
        <div className="grid grid-cols-2 gap-2 p-4 bg-secondary/30 border-t border-border">
          <button
            onClick={onReject}
            disabled={accepting || rejecting}
            className="rounded-xl border-2 border-destructive/30 bg-card py-3.5 text-sm font-bold text-destructive disabled:opacity-50 transition-all hover:bg-destructive/5 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <X className="h-4 w-4" />
            {rejecting ? "Rejecting..." : "Reject"}
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
