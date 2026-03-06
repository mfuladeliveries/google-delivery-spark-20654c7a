import { Navigation, Phone, ExternalLink, MapPin } from "lucide-react";
import DeliveryVerification from "@/components/DeliveryVerification";
import DriverDeliveryMap from "./DriverDeliveryMap";

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
}

const openGoogleMaps = (address: string) => {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, "_blank");
};

const DriverActiveDelivery = ({ orders, driverLocation, onDeliveryComplete }: DriverActiveDeliveryProps) => {
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
        <p className="text-xs text-muted-foreground mt-1">Enter customer's delivery code to complete.</p>
      </div>

      {orders.map(order => (
        <div key={order.id} className="rounded-2xl border-2 border-primary bg-card shadow-orange overflow-hidden">
          {/* Map */}
          <DriverDeliveryMap
            driverLocation={driverLocation}
            customerAddress={order.customer_address}
            restaurantName={order.restaurant}
          />

          <div className="p-4 space-y-4">
            {/* Order info */}
            <div className="flex items-start justify-between">
              <div>
                <span className="font-bold text-foreground text-lg">Order #{order.order_number}</span>
                <span className="ml-2 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                  On the way
                </span>
              </div>
              <span className="font-bold text-primary text-lg">R{order.total}</span>
            </div>

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

            {/* Verification */}
            <DeliveryVerification orderId={order.id} onVerified={onDeliveryComplete} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default DriverActiveDelivery;
