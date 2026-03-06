import { MapPin, Clock, Package, ExternalLink, Phone, Navigation } from "lucide-react";

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

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const openGoogleMaps = (address: string) => {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, "_blank");
};

const DriverJobBoard = ({ orders, isOnline, accepting, onAccept, driverLocation }: DriverJobBoardProps) => {
  return (
    <div className="space-y-4">
      {!isOnline && (
        <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-4 text-center">
          <p className="text-sm font-bold text-destructive">You're offline</p>
          <p className="text-xs text-destructive/80 mt-1">Go online to receive delivery requests</p>
        </div>
      )}

      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4">
        <p className="text-sm text-foreground font-semibold flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" /> Job Board
        </p>
        <p className="text-xs text-muted-foreground mt-1">Orders ready for pickup. Accept to start delivery.</p>
      </div>

      {orders.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <Package className="mx-auto h-12 w-12 opacity-30 mb-3" />
          <p className="font-semibold text-lg">No available jobs</p>
          <p className="text-sm mt-1">Check back soon for new deliveries</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.id} className="rounded-2xl border border-border bg-card p-4 shadow-card hover:shadow-orange/20 transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="font-bold text-foreground text-lg">#{order.order_number}</span>
                  <p className="text-sm text-muted-foreground mt-0.5">🍽️ {order.restaurant}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-primary text-lg">R{order.total}</span>
                  <p className="text-xs text-[hsl(var(--driver-success))] font-bold">+R{order.delivery_fee} fee</p>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span className="flex-1 truncate">{order.customer_address}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); openGoogleMaps(order.customer_address); }}
                    className="flex items-center gap-1 rounded-lg bg-[hsl(var(--driver-info)/0.1)] px-2.5 py-1 text-[hsl(var(--driver-info))] font-semibold text-xs hover:bg-[hsl(var(--driver-info)/0.2)] transition-colors"
                  >
                    <Navigation className="h-3 w-3" /> Maps
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{new Date(order.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="mx-1">·</span>
                  <span>{order.items.length} item{order.items.length !== 1 ? "s" : ""}</span>
                </div>
              </div>

              <div className="border-t border-border pt-3 mb-3">
                <div className="space-y-1">
                  {order.items.slice(0, 3).map((item: any, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground">{item.quantity}× {item.name}</p>
                  ))}
                  {order.items.length > 3 && (
                    <p className="text-xs text-primary font-medium">+{order.items.length - 3} more items</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <a
                  href={`tel:${order.customer_contact}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary/80 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="h-4 w-4" />
                </a>
                <button
                  onClick={() => onAccept(order.id)}
                  disabled={accepting === order.id || !isOnline}
                  className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-orange"
                >
                  {accepting === order.id ? "Accepting..." : !isOnline ? "Go online to accept" : "🚗 Accept Delivery"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DriverJobBoard;
