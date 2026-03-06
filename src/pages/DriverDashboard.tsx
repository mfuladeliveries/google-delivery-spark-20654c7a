import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Truck, MapPin, Clock, ArrowLeft, Package, Navigation } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import DeliveryVerification from "@/components/DeliveryVerification";
import { toast } from "sonner";

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
}

const DriverDashboard = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"jobs" | "active">("jobs");
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const locationWatchRef = useRef<number | null>(null);
  const prevJobCountRef = useRef(0);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      osc.type = "triangle";
      gain.gain.value = 0.4;
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 880;
        osc2.type = "triangle";
        gain2.gain.value = 0.4;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.2);
      }, 150);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!authLoading && (!user || (role !== 'driver' && role !== 'admin'))) {
      navigate("/");
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchOrders();

    const channel = supabase
      .channel('driver-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Live GPS location broadcasting
  useEffect(() => {
    if (!user || myOrders.length === 0) {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
      return;
    }

    locationWatchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const activeIds = myOrders.map(o => o.id);
        for (const id of activeIds) {
          await supabase.from("orders").update({
            driver_lat: pos.coords.latitude,
            driver_lng: pos.coords.longitude,
            driver_location_updated_at: new Date().toISOString(),
          }).eq("id", id);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
    };
  }, [user, myOrders.length]);

  const fetchOrders = async () => {
    const [{ data: pending }, { data: mine }] = await Promise.all([
      supabase.from("orders").select("*").eq("status", "ready").is("driver_id", null).order("created_at"),
      supabase.from("orders").select("*").eq("driver_id", user!.id).in("status", ["out_for_delivery"]).order("created_at"),
    ]);
    if (pending) setPendingOrders(pending.map(o => ({ ...o, items: (o.items as any[]) || [] })));
    if (mine) setMyOrders(mine.map(o => ({ ...o, items: (o.items as any[]) || [] })));
    setLoading(false);
  };

  const acceptDelivery = async (orderId: string) => {
    setAccepting(orderId);
    await supabase.from("orders").update({
      driver_id: user!.id,
      status: "out_for_delivery",
    }).eq("id", orderId);
    await fetchOrders();
    setTab("active");
    setAccepting(null);
  };

  if (authLoading || loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl shadow-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to="/" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <Truck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-sm text-foreground">Driver Portal</h1>
                <p className="text-[10px] text-muted-foreground">Mfula Deliveries</p>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            {(["jobs", "active"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {t === "jobs" ? `Jobs (${pendingOrders.length})` : `Active (${myOrders.length})`}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 pb-nav md:pb-8">
        {tab === "jobs" ? (
          <>
            <div className="mb-4 rounded-2xl border border-border bg-primary/5 p-3">
              <p className="text-sm text-foreground font-medium">📦 Job Board</p>
              <p className="text-xs text-muted-foreground mt-0.5">Orders ready for pickup. Accept to start delivery.</p>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Package className="mx-auto h-10 w-10 opacity-40 mb-2" />
                <p className="font-semibold">No available jobs</p>
                <p className="text-sm mt-1">Check back soon for new deliveries</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingOrders.map(order => (
                  <div key={order.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-bold text-foreground">Order #{order.order_number}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">🍽️ {order.restaurant}</p>
                      </div>
                      <span className="font-bold text-primary text-sm">R{order.total}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <MapPin className="h-3 w-3 text-primary" />
                      <span>{order.customer_address}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(order.created_at).toLocaleTimeString("en-ZA")}</span>
                    </div>
                    <div className="border-t border-border pt-2 mb-3 space-y-1">
                      {order.items.slice(0, 3).map((item: any, i: number) => (
                        <p key={i} className="text-xs text-muted-foreground">{item.quantity}x {item.name}</p>
                      ))}
                      {order.items.length > 3 && <p className="text-xs text-muted-foreground">+{order.items.length - 3} more items</p>}
                    </div>
                    <button
                      onClick={() => acceptDelivery(order.id)}
                      disabled={accepting === order.id}
                      className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                    >
                      {accepting === order.id ? "Accepting..." : "Accept Delivery"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-4 rounded-2xl border border-border bg-primary/5 p-3">
              <p className="text-sm text-foreground font-medium">🚗 Current Trips</p>
              <p className="text-xs text-muted-foreground mt-0.5">Your active deliveries. Enter customer's code to complete.</p>
            </div>

            {myOrders.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Navigation className="mx-auto h-10 w-10 opacity-40 mb-2" />
                <p className="font-semibold">No active deliveries</p>
                <p className="text-sm mt-1">Accept a job from the Job Board</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myOrders.map(order => (
                  <div key={order.id} className="rounded-2xl border-2 border-primary bg-card p-4 shadow-orange">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-bold text-foreground">Order #{order.order_number}</span>
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">On the way</span>
                      </div>
                      <span className="font-bold text-primary">R{order.total}</span>
                    </div>
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        {order.customer_address}
                      </div>
                      <p className="text-xs text-muted-foreground">📞 {order.customer_name} · {order.customer_contact}</p>
                    </div>
                    <DeliveryVerification
                      orderId={order.id}
                      onVerified={fetchOrders}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default DriverDashboard;
