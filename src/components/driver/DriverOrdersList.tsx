import { useState, useEffect } from "react";
import { MapPin, Clock, Package, Navigation, Phone, User, Store, CheckCircle2, Truck, Check, X } from "lucide-react";

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

interface DriverOrdersListProps {
  assignedOrders: Order[];
  availableOrders: Order[];
  isOnline: boolean;
  driverLocation: { lat: number; lng: number } | null;
  onCardClick?: (orderId: string) => void;
}

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const geocodeCache: Record<string, { lat: number; lng: number } | null> = {};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  ready: { label: "Pending", bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  driver_assigned: { label: "Accepted", bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  picking_up: { label: "Picking Up", bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400" },
  out_for_delivery: { label: "Picked Up", bg: "bg-primary/10", text: "text-primary" },
  delivered: { label: "Delivered", bg: "bg-[hsl(var(--driver-success)/0.1)]", text: "text-[hsl(var(--driver-success))]" },
};

const openGoogleMaps = (address: string) => {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, "_blank");
};

const OrderCard = ({
  order,
  distance,
  onClick,
}: {
  order: Order;
  distance: number | null;
  onClick?: () => void;
}) => {
  const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.ready;
  const minutesAgo = Math.max(0, Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000));
  const isAssigned = order.status !== "ready";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border-2 ${
        isAssigned ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      } p-4 shadow-card hover:shadow-orange/20 transition-all active:scale-[0.99]`}
    >
      {/* Header: # + status + amount */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground text-base">#{order.order_number}</span>
          <span className={`rounded-full ${status.bg} ${status.text} px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide`}>
            {status.label}
          </span>
        </div>
        <div className="text-right">
          <span className="font-bold text-primary text-lg leading-none">R{order.total}</span>
          <p className="text-[10px] text-[hsl(var(--driver-success))] font-bold mt-0.5">+R{order.delivery_fee} fee</p>
        </div>
      </div>

      {/* Customer */}
      <div className="flex items-center gap-2 mb-2 text-sm">
        <User className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-foreground font-semibold truncate">
          {order.customer_name || "Customer"}
        </span>
        {isAssigned && order.customer_contact && (
          <a
            href={`tel:${order.customer_contact}`}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--driver-success)/0.1)] text-[hsl(var(--driver-success))]"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Pickup */}
      <div className="flex items-start gap-2 mb-1.5 text-xs">
        <Store className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Pickup</p>
          <p className="text-foreground truncate">{order.restaurant}</p>
        </div>
      </div>

      {/* Delivery */}
      <div className="flex items-start gap-2 mb-3 text-xs">
        <MapPin className="h-4 w-4 text-[hsl(var(--driver-info))] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Delivery</p>
          <p className="text-foreground truncate">{order.customer_address}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            openGoogleMaps(order.customer_address);
          }}
          className="rounded-lg bg-[hsl(var(--driver-info)/0.1)] px-2 py-1 text-[hsl(var(--driver-info))] font-semibold text-[10px] flex items-center gap-1"
        >
          <Navigation className="h-3 w-3" /> Maps
        </button>
      </div>

      {/* Footer: distance + time */}
      <div className="flex items-center gap-3 text-[11px] border-t border-border/60 pt-2">
        <span className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {distance !== null ? `${distance.toFixed(1)} km` : "— km"}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {minutesAgo}m ago
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">{order.items.length} items</span>
      </div>
    </button>
  );
};

const DriverOrdersList = ({
  assignedOrders,
  availableOrders,
  isOnline,
  driverLocation,
  onCardClick,
}: DriverOrdersListProps) => {
  const [distances, setDistances] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (!driverLocation) return;
    const all = [...assignedOrders, ...availableOrders];
    all.forEach(async (order) => {
      if (distances[order.id] !== undefined) return;
      const key = order.customer_address || order.restaurant;
      if (geocodeCache[key] !== undefined) {
        const pos = geocodeCache[key];
        const d = pos ? getDistance(driverLocation.lat, driverLocation.lng, pos.lat, pos.lng) : null;
        setDistances((p) => ({ ...p, [order.id]: d }));
        return;
      }
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(key)}&format=json&limit=1`
        );
        const data = await res.json();
        if (data?.[0]) {
          const pos = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          geocodeCache[key] = pos;
          setDistances((p) => ({ ...p, [order.id]: getDistance(driverLocation.lat, driverLocation.lng, pos.lat, pos.lng) }));
        } else {
          geocodeCache[key] = null;
          setDistances((p) => ({ ...p, [order.id]: null }));
        }
      } catch {
        geocodeCache[key] = null;
        setDistances((p) => ({ ...p, [order.id]: null }));
      }
    });
  }, [assignedOrders, availableOrders, driverLocation]);

  return (
    <div className="space-y-4">
      {!isOnline && (
        <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-4 text-center">
          <p className="text-sm font-bold text-destructive">You're offline</p>
          <p className="text-xs text-destructive/80 mt-1">Go online to receive new delivery requests</p>
        </div>
      )}

      {/* Assigned section */}
      {assignedOrders.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Truck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">My Deliveries</h2>
            <span className="text-xs text-muted-foreground">({assignedOrders.length})</span>
          </div>
          <div className="space-y-3">
            {assignedOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                distance={distances[o.id] ?? null}
                onClick={() => onCardClick?.(o.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Available section */}
      <section>
        <div className="flex items-center gap-2 mb-2 px-1">
          <Package className="h-4 w-4 text-[hsl(var(--driver-info))]" />
          <h2 className="text-sm font-bold text-foreground">Available Nearby</h2>
          <span className="text-xs text-muted-foreground">({availableOrders.length})</span>
        </div>
        {availableOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-10 text-center text-muted-foreground">
            <Package className="mx-auto h-10 w-10 opacity-30 mb-2" />
            <p className="text-sm font-semibold">No orders available right now</p>
            <p className="text-xs mt-1">You'll be notified when a new one arrives</p>
          </div>
        ) : (
          <div className="space-y-3">
            {availableOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                distance={distances[o.id] ?? null}
                onClick={() => onCardClick?.(o.id)}
              />
            ))}
          </div>
        )}
      </section>

      {assignedOrders.length === 0 && availableOrders.length === 0 && (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-[hsl(var(--driver-success))] opacity-60" />
        </div>
      )}
    </div>
  );
};

export default DriverOrdersList;
