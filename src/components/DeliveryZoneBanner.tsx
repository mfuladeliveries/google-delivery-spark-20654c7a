import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, AlertTriangle, Truck, ChevronRight } from "lucide-react";
import { useDeliveryZone } from "@/hooks/useDeliveryZone";
import { useAuth } from "@/hooks/useAuth";
import { ALL_DELIVERY_AREAS } from "@/lib/zones";
import { UpdateAddressSheet } from "@/components/UpdateAddressSheet";

const DeliveryZoneBanner = () => {
  const { user } = useAuth();
  const { loading, address, zone, outsideZone, needsAddress, refresh } = useDeliveryZone();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Logged-out: show a generic banner with both zones (no pricing)
  if (!user) {
    return (
      <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Delivery areas</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <Link to="/auth" className="font-semibold text-primary hover:underline">Sign in</Link> to confirm we deliver to you.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mb-4 h-20 rounded-2xl border border-border bg-card animate-pulse" />
    );
  }

  // No saved address: prompt to set one
  if (needsAddress) {
    return (
      <Link
        to="/profile"
        className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 shadow-card transition-colors hover:bg-primary/10"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Set your delivery address</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            We need your address to confirm your delivery zone & fee before you can order.
          </p>
        </div>
        <ChevronRight className="h-5 w-5 flex-shrink-0 text-primary" />
      </Link>
    );
  }

  // Address outside both zones — block ordering
  if (outsideZone) {
    return (
      <>
        <div className="mb-4 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4 shadow-card">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-destructive text-destructive-foreground">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Outside our delivery area</p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{address}</p>
              <p className="mt-1.5 text-xs text-foreground">
                We currently deliver to: <span className="font-semibold">{ALL_DELIVERY_AREAS}</span>.
              </p>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                Update address <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
        <UpdateAddressSheet open={sheetOpen} onOpenChange={setSheetOpen} onSaved={refresh} />
      </>
    );
  }

  // Happy path — show zone & fee
  if (zone) {
    return (
      <div className="mb-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-foreground">{zone.name}</p>
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                R{zone.fee} delivery
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              <MapPin className="inline h-3 w-3" /> {address}
            </p>
          </div>
          <Link
            to="/profile"
            className="flex-shrink-0 text-xs font-semibold text-primary hover:underline"
          >
            Change
          </Link>
        </div>
      </div>
    );
  }

  return null;
};

export default DeliveryZoneBanner;
