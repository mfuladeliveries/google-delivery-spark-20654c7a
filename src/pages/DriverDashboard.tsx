import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { sendPushNotification } from "@/lib/pushNotify";
import DriverHeader from "@/components/driver/DriverHeader";
import DriverBottomNav from "@/components/driver/DriverBottomNav";
import DriverOrdersList from "@/components/driver/DriverOrdersList";
import NewOrderModal from "@/components/driver/NewOrderModal";
import DriverActiveDelivery from "@/components/driver/DriverActiveDelivery";
import DriverEarnings from "@/components/driver/DriverEarnings";
import DriverProfileTab from "@/components/driver/DriverProfile";

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

type DriverTab = "orders" | "earnings" | "profile";

const DriverDashboard = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<DriverTab>("orders");
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [activeOffer, setActiveOffer] = useState<Order | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const locationWatchRef = useRef<number | null>(null);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 660; osc.type = "triangle"; gain.gain.value = 0.4;
      osc.start(); osc.stop(ctx.currentTime + 0.2);
      setTimeout(() => {
        const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.frequency.value = 880; o2.type = "triangle"; g2.gain.value = 0.4;
        o2.start(); o2.stop(ctx.currentTime + 0.2);
      }, 150);
    } catch {}
  }, []);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/driver/auth"); return; }
    const hasAccess = roles.includes("driver") || roles.includes("admin");
    if (!hasAccess) navigate("/driver/auth");
  }, [user, roles, authLoading, navigate]);

  // Initial load + realtime
  useEffect(() => {
    if (!user) return;
    fetchAll();

    const channel = supabase
      .channel("driver-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Pop modal when a new pending order appears (not rejected, no active offer, and driver is online)
  useEffect(() => {
    if (!driverProfile?.is_online) return;
    if (activeOffer) return;
    const next = pendingOrders.find((o) => !rejectedIds.has(o.id));
    if (next) {
      setActiveOffer(next);
      playNotificationSound();
    }
  }, [pendingOrders, rejectedIds, driverProfile?.is_online, activeOffer, playNotificationSound]);

  // GPS tracking when online
  useEffect(() => {
    if (!user || !driverProfile?.is_online) {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
      return;
    }
    locationWatchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDriverLocation(loc);
        await supabase.from("driver_profiles").update({
          current_lat: loc.lat,
          current_lng: loc.lng,
          location_updated_at: new Date().toISOString(),
        }).eq("user_id", user!.id);
        const activeIds = myOrders.map((o) => o.id);
        for (const id of activeIds) {
          await supabase.rpc("driver_update_order", { p_order_id: id, p_status: null, p_lat: loc.lat, p_lng: loc.lng });
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
    };
  }, [user, driverProfile?.is_online, myOrders.length]);

  const fetchAll = async () => {
    await Promise.all([fetchOrders(), fetchDriverProfile(), fetchCompletedOrders(), fetchRejected()]);
    setLoading(false);
  };

  const fetchRejected = async () => {
    const { data } = await supabase
      .from("driver_rejected_orders")
      .select("order_id")
      .eq("driver_id", user!.id);
    if (data) setRejectedIds(new Set(data.map((r: any) => r.order_id)));
  };

  const fetchOrders = async () => {
    // Hide anything older than 12 hours — auto-expired
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const [{ data: pending }, { data: mine }] = await Promise.all([
      supabase.from("driver_job_board" as any).select("id, order_number, restaurant, customer_address, total, delivery_fee, created_at, items").gte("created_at", cutoff).order("created_at"),
      supabase.from("orders").select("*").eq("driver_id", user!.id).in("status", ["driver_assigned", "picking_up", "out_for_delivery"]).gte("created_at", cutoff).order("created_at"),
    ]);
    if (pending) setPendingOrders((pending as any[]).map((o: any) => ({ ...o, items: (o.items as any[]) || [], customer_name: "", customer_contact: "", status: "ready" })));
    if (mine) setMyOrders(mine.map((o) => ({ ...o, items: (o.items as any[]) || [] })));
  };

  const fetchCompletedOrders = async () => {
    const { data } = await supabase
      .from("orders").select("*").eq("driver_id", user!.id).eq("status", "delivered")
      .order("created_at", { ascending: false }).limit(50);
    if (data) setCompletedOrders(data.map((o) => ({ ...o, items: (o.items as any[]) || [] })));
  };

  const fetchDriverProfile = async () => {
    const { data } = await supabase
      .from("driver_profiles").select("is_online, total_earnings, total_deliveries")
      .eq("user_id", user!.id).maybeSingle();
    if (data) setDriverProfile(data);
    else {
      await supabase.from("driver_profiles").insert({ user_id: user!.id });
      setDriverProfile({ is_online: false, total_earnings: 0, total_deliveries: 0 });
    }
  };

  const toggleOnline = async () => {
    if (!driverProfile) return;
    setTogglingOnline(true);
    const newStatus = !driverProfile.is_online;
    await supabase.from("driver_profiles").update({ is_online: newStatus }).eq("user_id", user!.id);
    setDriverProfile((prev) => (prev ? { ...prev, is_online: newStatus } : prev));
    toast.success(newStatus ? "You're now online! 🟢" : "You're now offline 🔴");
    setTogglingOnline(false);
  };

  const handleAccept = async (orderId: string) => {
    const order =
      (activeOffer && activeOffer.id === orderId ? activeOffer : null) ||
      pendingOrders.find((o) => o.id === orderId);
    if (!order) return;
    setAcceptingId(orderId);
    const { data, error } = await supabase.rpc("claim_order", { p_order_id: orderId });
    if (error) {
      toast.error(error.message || "Failed to accept");
      setAcceptingId(null);
      return;
    }
    if (data === false) {
      toast.error("Order already taken by another driver");
      if (activeOffer?.id === orderId) setActiveOffer(null);
      await fetchOrders();
      setAcceptingId(null);
      return;
    }
    sendPushNotification({
      order_id: order.id,
      order_number: order.order_number,
      status: "driver_assigned",
      restaurant: order.restaurant,
      total: order.total,
      user_id: (order as any).user_id,
      driver_id: user!.id,
      restaurant_id: null,
      old_status: "ready",
    });
    toast.success("Delivery accepted! Head to the restaurant. 🚗");
    if (activeOffer?.id === orderId) setActiveOffer(null);
    await fetchOrders();
    setAcceptingId(null);
  };

  const handleReject = async (orderId: string) => {
    setRejectingId(orderId);
    const { error } = await supabase
      .from("driver_rejected_orders")
      .insert({ driver_id: user!.id, order_id: orderId });
    if (error && !error.message.includes("duplicate")) {
      toast.error("Failed to reject");
      setRejectingId(null);
      return;
    }
    setRejectedIds((prev) => new Set(prev).add(orderId));
    if (activeOffer?.id === orderId) setActiveOffer(null);
    setRejectingId(null);
  };

  const handleAcceptOffer = () => activeOffer && handleAccept(activeOffer.id);
  const handleRejectOffer = () => activeOffer && handleReject(activeOffer.id);

  const handleDeliveryComplete = () => {
    fetchOrders();
    fetchCompletedOrders();
    fetchDriverProfile();
    setExpandedOrderId(null);
    toast.success("Delivery completed! 🎉");
  };

  // Available = pending minus rejected
  const availableOrders = useMemo(
    () => pendingOrders.filter((o) => !rejectedIds.has(o.id)),
    [pendingOrders, rejectedIds]
  );

  const expandedOrder = expandedOrderId ? myOrders.find((o) => o.id === expandedOrderId) ?? null : null;

  if (authLoading || loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary border-t-transparent" />
      </div>
    );

  const isOnline = driverProfile?.is_online ?? false;

  return (
    <div className="min-h-screen bg-background">
      <DriverHeader
        isOnline={isOnline}
        togglingOnline={togglingOnline}
        onToggleOnline={toggleOnline}
        activeCount={myOrders.length}
        onProfileClick={() => setTab("profile")}
      />

      <main className="mx-auto max-w-2xl px-4 py-4 pb-24">
        {tab === "orders" && (
          <>
            {expandedOrder ? (
              <div className="space-y-3">
                <button
                  onClick={() => setExpandedOrderId(null)}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  ← Back to orders
                </button>
                <DriverActiveDelivery
                  orders={[expandedOrder]}
                  driverLocation={driverLocation}
                  onDeliveryComplete={handleDeliveryComplete}
                  onStatusChange={fetchOrders}
                />
              </div>
            ) : (
              <DriverOrdersList
                assignedOrders={myOrders}
                availableOrders={availableOrders}
                isOnline={isOnline}
                driverLocation={driverLocation}
                onCardClick={(id) => {
                  if (myOrders.some((o) => o.id === id)) setExpandedOrderId(id);
                }}
              />
            )}
          </>
        )}

        {tab === "earnings" && (
          <DriverEarnings driverProfile={driverProfile} completedOrders={completedOrders} />
        )}

        {tab === "profile" && <DriverProfileTab />}
      </main>

      <DriverBottomNav
        activeTab={tab}
        onTabChange={setTab}
        jobCount={availableOrders.length}
        activeCount={myOrders.length}
      />

      <NewOrderModal
        open={!!activeOffer}
        offer={activeOffer}
        distanceKm={null}
        accepting={accepting}
        rejecting={rejecting}
        onAccept={handleAcceptOffer}
        onReject={handleRejectOffer}
      />
    </div>
  );
};

export default DriverDashboard;
