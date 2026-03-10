import { useState, Component, ReactNode, lazy, Suspense } from "react";
import { Navigation, Phone, ExternalLink, MapPin, CheckCircle2, Truck, Package, ShieldCheck } from "lucide-react";
import DeliveryVerification from "@/components/DeliveryVerification";

const DriverDeliveryMap = lazy(() => import("@/components/driver/DriverDeliveryMap"));

class MapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <div className="h-56 w-full bg-muted rounded-t-2xl flex items-center justify-center text-muted-foreground text-sm">Map unavailable</div>;
    }
    return this.props.children;
  }
}
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendPushNotification } from "@/lib/pushNotify";

interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  customer_contact: string;
  customer_address: string;
  items: any[];
  total: number;
  status: string;
  restaurant: string;
  created_at: string;
  delivery_fee: number;
}

interface DriverActiveDeliveryProps {
  orders: Order[];
  driverLocation: { lat: number; lng: number } | null;
  onDeliveryComplete: () => void;
  onStatusChange?: () => void;
}

const openGoogleMaps = (address: string) => {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, "_blank");
};

// Progress steps based on status
const STEPS = [
  { key: "driver_assigned", label: "Assigned", icon: Package },
  { key: "picking_up", label: "Picking Up", icon: Truck },
  { key: "out_for_delivery", label: "On the Way", icon: Navigation },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const getStepIndex = (status: string) => {
  if (status === "out_for_delivery") return 2;
  if (status === "picking_up") return 1;
  if (status === "delivered") return 3;
  return 0; // driver_assigned or default
};

const DriverActiveDelivery = ({ orders, driverLocation, onDeliveryComplete, onStatusChange }: DriverActiveDeliveryProps) => {
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const handleConfirmArrival = async (orderId: string) => {
    setUpdatingStatus(orderId);
    const { error } = await supabase.rpc("driver_update_order", { p_order_id: orderId, p_status: "picking_up" });
    if (error) {
      toast.error(error.message || "Failed to update status");
    } else {
      toast.success("Arrival confirmed! Pick up the order.");
    }
    onStatusChange?.();
    setUpdatingStatus(null);
  };

  const handleConfirmPickup = async (orderId: string) => {
    setUpdatingStatus(orderId);
    const { error } = await supabase.rpc("driver_update_order", { p_order_id: orderId, p_status: "out_for_delivery" });
    if (error) {
      toast.error(error.message || "Failed to update status");
    } else {
      toast.success("Pickup confirmed! Heading to customer.");
    }
    onStatusChange?.();
    setUpdatingStatus(null);
  };

  if (orders.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <Navigation className="mx-auto h-12 w-12 opacity-30 mb-3" />
        <p className="font-semibold text-lg">No active deliveries</p>
        <p className="text-sm mt-1">Accept a job from the Job Board</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4">
        <p className="text-sm text-foreground font-semibold flex items-center gap-2">
          <Navigation className="h-4 w-4 text-primary" /> Current Trips
        </p>
        <p className="text-xs text-muted-foreground mt-1">Follow the progress bar for each delivery.</p>
      </div>

      {orders.map(order => {
        const currentStep = getStepIndex(order.status);

        return (
          <div key={order.id} className="rounded-2xl border-2 border-primary bg-card shadow-orange overflow-hidden">
            {/* Map */}
            {driverLocation ? (
              <MapErrorBoundary>
                <Suspense fallback={<div className="h-56 w-full bg-muted rounded-t-2xl flex items-center justify-center text-muted-foreground text-sm">Loading map…</div>}>
                  <DriverDeliveryMap
                    driverLocation={driverLocation}
                    customerAddress={order.customer_address}
                    restaurantName={order.restaurant}
                  />
                </Suspense>
              </MapErrorBoundary>
            ) : (
              <div className="h-56 w-full bg-muted rounded-t-2xl flex items-center justify-center text-muted-foreground text-sm">
                📍 Delivery map available when GPS is active
              </div>
            )}

            <div className="p-4 space-y-4">
              {/* Order info */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-bold text-foreground text-lg">Order #{order.order_number}</span>
                  <span className="ml-2 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary capitalize">
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="font-bold text-primary text-lg">R{order.total}</span>
              </div>

              {/* Progress bar */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  {STEPS.map((step, i) => {
                    const Icon = step.icon;
                    const isActive = i <= currentStep;
                    const isCurrent = i === currentStep;
                    return (
                      <div key={step.key} className="flex flex-col items-center z-10 relative">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                          isCurrent
                            ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110"
                            : isActive
                              ? "bg-[hsl(var(--driver-success))] text-white"
                              : "bg-secondary text-muted-foreground"
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className={`text-[9px] mt-1 font-semibold ${isCurrent ? "text-primary" : isActive ? "text-[hsl(var(--driver-success))]" : "text-muted-foreground"}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Progress line */}
                <div className="absolute top-4 left-4 right-4 h-0.5 bg-secondary -z-0">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Action buttons based on status */}
              {(order.status === "driver_assigned" || order.status === "ready") && (
                <button
                  onClick={() => handleConfirmArrival(order.id)}
                  disabled={updatingStatus === order.id}
                  className="w-full rounded-xl bg-[hsl(var(--driver-info))] py-3.5 text-sm font-bold text-white disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  {updatingStatus === order.id ? "Updating..." : "Confirm Arrival at Restaurant"}
                </button>
              )}

              {order.status === "picking_up" && (
                <button
                  onClick={() => handleConfirmPickup(order.id)}
                  disabled={updatingStatus === order.id}
                  className="w-full rounded-xl bg-[hsl(var(--driver-warning))] py-3.5 text-sm font-bold text-white disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <Truck className="h-4 w-4" />
                  {updatingStatus === order.id ? "Updating..." : "Confirm Pickup — Head to Customer"}
                </button>
              )}

              {/* Navigate button */}
              <button
                onClick={() => openGoogleMaps(order.customer_address)}
                className="flex w-full items-center gap-3 rounded-2xl bg-[hsl(var(--driver-info)/0.08)] border border-[hsl(var(--driver-info)/0.2)] px-4 py-3.5 text-sm font-semibold text-[hsl(var(--driver-info))] hover:bg-[hsl(var(--driver-info)/0.15)] transition-colors"
              >
                <Navigation className="h-5 w-5" />
                <span className="flex-1 text-left truncate">{order.customer_address}</span>
                <ExternalLink className="h-4 w-4 shrink-0" />
              </button>

              {/* Customer info & call */}
              <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{order.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{order.customer_contact}</p>
                </div>
                <a
                  href={`tel:${order.customer_contact}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--driver-success)/0.1)] text-[hsl(var(--driver-success))] hover:bg-[hsl(var(--driver-success)/0.2)] transition-colors"
                >
                  <Phone className="h-5 w-5" />
                </a>
              </div>

              {/* Order items */}
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Order Items</p>
                <div className="space-y-1">
                  {order.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-foreground">{item.quantity}× {item.name}</span>
                      <span className="text-muted-foreground">R{(item.price * item.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 border-t border-border pt-2 flex justify-between">
                  <span className="text-sm font-bold text-foreground">Delivery Fee</span>
                  <span className="text-sm font-bold text-[hsl(var(--driver-success))]">+R{order.delivery_fee}</span>
                </div>
              </div>

              {/* Verification - only show when out for delivery */}
              {order.status === "out_for_delivery" && (
                <DeliveryVerification orderId={order.id} onVerified={onDeliveryComplete} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DriverActiveDelivery;
