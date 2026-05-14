import { useState, useEffect } from "react";
import {
  MapPin,
  Clock,
  Package,
  ExternalLink,
  Phone,
  Navigation,
  Filter,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { driverPayoutForFee } from "@/lib/serviceArea";

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

interface DriverJobBoardProps {
  orders: Order[];
  isOnline: boolean;
  accepting: string | null;
  onAccept: (orderId: string) => void;
  driverLocation: { lat: number; lng: number } | null;
}

type SortOption = "distance" | "fee" | "urgency";

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const openGoogleMaps = (address: string) => {
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
    "_blank",
  );
};

const getMinutesSinceCreated = (createdAt: string) => {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
};

const getUrgencyColor = (minutes: number) => {
  if (minutes > 20)
    return {
      border: "border-destructive/40",
      bg: "bg-destructive/5",
      label: "Urgent",
      color: "text-destructive",
    };
  if (minutes > 10)
    return {
      border: "border-[hsl(var(--driver-warning)/0.4)]",
      bg: "bg-[hsl(var(--driver-warning)/0.05)]",
      label: "Waiting",
      color: "text-[hsl(var(--driver-warning))]",
    };
  return {
    border: "border-border",
    bg: "bg-card",
    label: "New",
    color: "text-[hsl(var(--driver-success))]",
  };
};

const getDistanceColor = (km: number | null) => {
  if (km === null) return "text-muted-foreground";
  if (km < 5) return "text-[hsl(var(--driver-success))]";
  if (km <= 10) return "text-[hsl(var(--driver-warning))]";
  return "text-destructive";
};

const getDistanceBadge = (km: number | null) => {
  if (km === null) return { bg: "bg-muted", text: "text-muted-foreground", label: "Unknown" };
  if (km < 5)
    return {
      bg: "bg-[hsl(var(--driver-success)/0.1)]",
      text: "text-[hsl(var(--driver-success))]",
      label: `${km.toFixed(1)} km`,
    };
  if (km <= 10)
    return {
      bg: "bg-[hsl(var(--driver-warning)/0.1)]",
      text: "text-[hsl(var(--driver-warning))]",
      label: `${km.toFixed(1)} km`,
    };
  return { bg: "bg-destructive/10", text: "text-destructive", label: `${km.toFixed(1)} km` };
};

const getEstimatedTime = (km: number | null) => {
  if (km === null) return "—";
  const mins = Math.round(km * 2.5 + 5); // rough estimate
  return `~${mins} min`;
};

// Simple geocode cache
const geocodeCache: Record<string, { lat: number; lng: number } | null> = {};

const DriverJobBoard = ({
  orders,
  isOnline,
  accepting,
  onAccept,
  driverLocation,
}: DriverJobBoardProps) => {
  const [sortBy, setSortBy] = useState<SortOption>("urgency");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [orderDistances, setOrderDistances] = useState<Record<string, number | null>>({});

  // Geocode restaurant addresses and calculate distances
  useEffect(() => {
    if (!driverLocation) return;
    orders.forEach(async (order) => {
      const key = order.restaurant;
      if (orderDistances[order.id] !== undefined) return;
      if (geocodeCache[key] !== undefined) {
        if (geocodeCache[key]) {
          const d = getDistance(
            driverLocation.lat,
            driverLocation.lng,
            geocodeCache[key]!.lat,
            geocodeCache[key]!.lng,
          );
          setOrderDistances((prev) => ({ ...prev, [order.id]: d }));
        }
        return;
      }
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(order.customer_address)}&format=json&limit=1`,
        );
        const data = await res.json();
        if (data?.[0]) {
          const pos = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          geocodeCache[key] = pos;
          const d = getDistance(driverLocation.lat, driverLocation.lng, pos.lat, pos.lng);
          setOrderDistances((prev) => ({ ...prev, [order.id]: d }));
        } else {
          geocodeCache[key] = null;
        }
      } catch {
        geocodeCache[key] = null;
      }
    });
  }, [orders, driverLocation]);

  const sortedOrders = [...orders].sort((a, b) => {
    if (sortBy === "distance") {
      return (orderDistances[a.id] ?? 999) - (orderDistances[b.id] ?? 999);
    }
    if (sortBy === "fee") {
      return b.delivery_fee - a.delivery_fee;
    }
    // urgency - oldest first
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // Filter to 10km radius if driver location known
  const filteredOrders = driverLocation
    ? sortedOrders.filter((o) => {
        const d = orderDistances[o.id];
        return d === undefined || d === null || d <= 10;
      })
    : sortedOrders;

  return (
    <div className="space-y-4">
      {!isOnline && (
        <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-4 text-center">
          <p className="text-sm font-bold text-destructive">You're offline</p>
          <p className="text-xs text-destructive/80 mt-1">Go online to receive delivery requests</p>
        </div>
      )}

      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-3 flex-1 mr-2">
          <p className="text-sm text-foreground font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Job Board
            <span className="ml-auto text-xs text-muted-foreground">
              {filteredOrders.length} available
            </span>
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-secondary transition-colors"
          >
            <Filter className="h-4 w-4" />
          </button>
          {showFilterMenu && (
            <div className="absolute right-0 top-12 z-20 w-44 rounded-xl border border-border bg-card shadow-lg p-1.5">
              {[
                { key: "urgency" as SortOption, label: "⏰ By Urgency", icon: AlertTriangle },
                { key: "distance" as SortOption, label: "📍 By Distance", icon: MapPin },
                { key: "fee" as SortOption, label: "💰 By Fee", icon: Zap },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setSortBy(opt.key);
                    setShowFilterMenu(false);
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                    sortBy === opt.key
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Distance legend */}
      <div className="flex items-center gap-3 text-[10px] font-semibold px-1">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[hsl(var(--driver-success))]" /> &lt;5 km
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[hsl(var(--driver-warning))]" /> 5–10 km
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-destructive" /> &gt;10 km
        </span>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <Package className="mx-auto h-12 w-12 opacity-30 mb-3" />
          <p className="font-semibold text-lg">No available jobs</p>
          <p className="text-sm mt-1">Check back soon for new deliveries</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const minutes = getMinutesSinceCreated(order.created_at);
            const urgency = getUrgencyColor(minutes);
            const dist = orderDistances[order.id] ?? null;
            const distBadge = getDistanceBadge(dist);
            const eta = getEstimatedTime(dist);

            return (
              <div
                key={order.id}
                className={`rounded-2xl border-2 ${urgency.border} ${urgency.bg} p-4 shadow-card hover:shadow-orange/20 transition-all`}
              >
                {/* Top row: order number + urgency + price */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-lg">
                        #{order.order_number}
                      </span>
                      {minutes > 20 && (
                        <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive animate-pulse">
                          <AlertTriangle className="h-3 w-3" /> URGENT
                        </span>
                      )}
                      {minutes <= 5 && (
                        <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--driver-success)/0.1)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--driver-success))]">
                          <Zap className="h-3 w-3" /> NEW
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">🍽️ {order.restaurant}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-primary text-lg">R{order.total}</span>
                    <p className="text-xs text-[hsl(var(--driver-success))] font-bold">
                      +R{driverPayoutForFee(order.delivery_fee)} payout
                    </p>
                  </div>
                </div>

                {/* Distance + ETA badges (no zone label) */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg ${distBadge.bg} px-2.5 py-1 text-xs font-bold ${distBadge.text}`}
                  >
                    <MapPin className="h-3 w-3" /> {distBadge.label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[hsl(var(--driver-info)/0.1)] px-2.5 py-1 text-xs font-bold text-[hsl(var(--driver-info))]">
                    <Clock className="h-3 w-3" /> {eta}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{minutes}m ago</span>
                </div>

                {/* Address */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span className="flex-1 truncate">{order.customer_address}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openGoogleMaps(order.customer_address);
                      }}
                      className="flex items-center gap-1 rounded-lg bg-[hsl(var(--driver-info)/0.1)] px-2.5 py-1 text-[hsl(var(--driver-info))] font-semibold text-xs hover:bg-[hsl(var(--driver-info)/0.2)] transition-colors"
                    >
                      <Navigation className="h-3 w-3" /> Maps
                    </button>
                  </div>
                </div>

                {/* Items preview */}
                <div className="border-t border-border/50 pt-2.5 mb-3">
                  <div className="space-y-0.5">
                    {order.items.slice(0, 3).map((item: any, i: number) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {item.quantity}× {item.name}
                      </p>
                    ))}
                    {order.items.length > 3 && (
                      <p className="text-xs text-primary font-medium">
                        +{order.items.length - 3} more items
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onAccept(order.id)}
                    disabled={accepting === order.id || !isOnline}
                    className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-orange"
                  >
                    {accepting === order.id
                      ? "Accepting..."
                      : !isOnline
                        ? "Go online to accept"
                        : "🚗 Accept Delivery"}
                  </button>
                  <button
                    onClick={() => onAccept(order.id)}
                    disabled={accepting === order.id || !isOnline}
                    className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-orange"
                  >
                    {accepting === order.id
                      ? "Accepting..."
                      : !isOnline
                        ? "Go online to accept"
                        : "🚗 Accept Delivery"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DriverJobBoard;
