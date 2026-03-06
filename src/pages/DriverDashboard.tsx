import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Truck, MapPin, Clock, ArrowLeft, Package, Navigation, DollarSign, Power, ExternalLink } from "lucide-react";
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
  delivery_fee: number;
}

interface DriverProfile {
  is_online: boolean;
  total_earnings: number;
  total_deliveries: number;
}

const DriverDashboard = () => {
  const { user, role, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"jobs" | "active" | "earnings">("jobs");
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const locationWatchRef = useRef<number | null>(null);

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
    fetchAll();

    const channel = supabase
      .channel('driver-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const newStatus = (payload.new as any)?.status;
        if (payload.eventType === 'UPDATE' && newStatus === 'ready') {
          playNotificationSound();
          toast.info("🚗 New delivery available!", { description: `Order #${(payload.new as any).order_number} is ready for pickup` });
        }
        fetchOrders();
      })
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

  const fetchAll = async () => {
    await Promise.all([fetchOrders(), fetchDriverProfile(), fetchCompletedOrders()]);
    setLoading(false);
  };

  const fetchOrders = async () => {
    const [{ data: pending }, { data: mine }] = await Promise.all([
      supabase.from("orders").select("*").eq("status", "ready").is("driver_id", null).order("created_at"),
      supabase.from("orders").select("*").eq("driver_id", user!.id).in("status", ["out_for_delivery"]).order("created_at"),
    ]);
    if (pending) setPendingOrders(pending.map(o => ({ ...o, items: (o.items as any[]) || [] })));
    if (mine) setMyOrders(mine.map(o => ({ ...o, items: (o.items as any[]) || [] })));
  };

  const fetchCompletedOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("driver_id", user!.id)
      .eq("status", "delivered")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setCompletedOrders(data.map(o => ({ ...o, items: (o.items as any[]) || [] })));
  };

  const fetchDriverProfile = async () => {
    const { data } = await supabase
      .from("driver_profiles")
      .select("is_online, total_earnings, total_deliveries")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (data) {
      setDriverProfile(data);
    } else {
      // Auto-create driver profile if missing
      await supabase.from("driver_profiles").insert({ user_id: user!.id });
      setDriverProfile({ is_online: false, total_earnings: 0, total_deliveries: 0 });
    }
  };

  const toggleOnline = async () => {
    if (!driverProfile) return;
    setTogglingOnline(true);
    const newStatus = !driverProfile.is_online;
    await supabase.from("driver_profiles").update({ is_online: newStatus }).eq("user_id", user!.id);
    setDriverProfile(prev => prev ? { ...prev, is_online: newStatus } : prev);
    toast.success(newStatus ? "You're now online! 🟢" : "You're now offline 🔴");
    setTogglingOnline(false);
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
    toast.success("Delivery accepted! Navigate to restaurant for pickup.");
  };

  const openGoogleMaps = (address: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  };

  if (authLoading || loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  const isOnline = driverProfile?.is_online ?? false;

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
          {/* Online/Offline Toggle */}
          <button
            onClick={toggleOnline}
            disabled={togglingOnline}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
              isOnline
                ? "bg-green-100 text-green-700 border border-green-200"
                : "bg-red-100 text-red-600 border border-red-200"
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            {togglingOnline ? "..." : isOnline ? "Online" : "Offline"}
          </button>
        </div>

        {/* Tab bar */}
        <div className="mx-auto flex max-w-2xl gap-1 px-4 pb-2">
          {(["jobs", "active", "earnings"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-xl py-2 text-xs font-bold capitalize transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t === "jobs" ? `Jobs (${pendingOrders.length})` : t === "active" ? `Active (${myOrders.length})` : "Earnings"}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 pb-nav md:pb-8">
        {!isOnline && tab !== "earnings" && (
          <div className="mb-4 rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-center">
            <p className="text-sm font-bold text-red-700">You're offline</p>
            <p className="text-xs text-red-600 mt-0.5">Go online to receive delivery requests</p>
          </div>
        )}

        {tab === "jobs" && (
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
                      <div className="text-right">
                        <span className="font-bold text-primary text-sm">R{order.total}</span>
                        <p className="text-[10px] text-green-600 font-semibold">+R{order.delivery_fee} fee</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <MapPin className="h-3 w-3 text-primary" />
                      <span className="flex-1">{order.customer_address}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); openGoogleMaps(order.customer_address); }}
                        className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-blue-600 font-semibold hover:bg-blue-100 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" /> Maps
                      </button>
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
                      disabled={accepting === order.id || !isOnline}
                      className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {accepting === order.id ? "Accepting..." : !isOnline ? "Go online to accept" : "Accept Delivery"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "active" && (
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
                    <div className="space-y-1.5 mb-3">
                      <button
                        onClick={() => openGoogleMaps(order.customer_address)}
                        className="flex w-full items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        <Navigation className="h-4 w-4" />
                        <span className="flex-1 text-left">{order.customer_address}</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <p className="text-xs text-muted-foreground px-1">📞 {order.customer_name} · {order.customer_contact}</p>
                    </div>
                    <DeliveryVerification
                      orderId={order.id}
                      onVerified={() => { fetchOrders(); fetchCompletedOrders(); fetchDriverProfile(); }}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "earnings" && (
          <>
            {/* Earnings Summary */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 mb-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-foreground">R{(driverProfile?.total_earnings || 0).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Total Earnings</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mb-2">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground">{driverProfile?.total_deliveries || 0}</p>
                <p className="text-xs text-muted-foreground">Deliveries</p>
              </div>
            </div>

            {/* Completed Deliveries */}
            <h3 className="font-bold text-foreground mb-3">📋 Delivery History</h3>
            {completedOrders.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <p className="font-semibold">No completed deliveries yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {completedOrders.map(order => (
                  <div key={order.id} className="rounded-xl border border-border bg-card p-3 shadow-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-sm text-foreground">#{order.order_number}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{order.restaurant}</span>
                      </div>
                      <span className="font-bold text-green-600 text-sm">+R{order.delivery_fee}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(order.created_at).toLocaleString("en-ZA")}
                    </p>
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
