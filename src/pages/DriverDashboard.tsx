import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import DriverHeader from "@/components/driver/DriverHeader";
import DriverBottomNav from "@/components/driver/DriverBottomNav";
import DriverJobBoard from "@/components/driver/DriverJobBoard";
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

type DriverTab = "jobs" | "active" | "earnings" | "profile";

const DriverDashboard = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<DriverTab>("jobs");
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
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
    } catch {}
  }, []);

  // Auth guard
  useEffect(() => {
    const hasAccess = roles.includes("driver") || roles.includes("admin");
    if (!authLoading && (!user || !hasAccess)) {
      navigate("/");
    }
  }, [user, roles, authLoading, navigate]);

  // Data + realtime
  useEffect(() => {
    if (!user) return;
    fetchAll();

    const channel = supabase
      .channel("driver-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        const newStatus = (payload.new as any)?.status;
        if (payload.eventType === "UPDATE" && newStatus === "ready") {
          playNotificationSound();
          toast.info("🚗 New delivery available!", {
            description: `Order #${(payload.new as any).order_number} is ready for pickup`,
          });
        }
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // GPS tracking
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

        const activeIds = myOrders.map((o) => o.id);
        for (const id of activeIds) {
          await supabase.from("orders").update({
            driver_lat: loc.lat,
            driver_lng: loc.lng,
            driver_location_updated_at: new Date().toISOString(),
          }).eq("id", id);
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
    await Promise.all([fetchOrders(), fetchDriverProfile(), fetchCompletedOrders()]);
    setLoading(false);
  };

  const fetchOrders = async () => {
    const [{ data: pending }, { data: mine }] = await Promise.all([
      supabase.from("orders").select("*").eq("status", "ready").is("driver_id", null).order("created_at"),
      supabase.from("orders").select("*").eq("driver_id", user!.id).in("status", ["driver_assigned", "picking_up", "out_for_delivery"]).order("created_at"),
    ]);
    if (pending) setPendingOrders(pending.map((o) => ({ ...o, items: (o.items as any[]) || [] })));
    if (mine) setMyOrders(mine.map((o) => ({ ...o, items: (o.items as any[]) || [] })));
  };

  const fetchCompletedOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("driver_id", user!.id)
      .eq("status", "delivered")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setCompletedOrders(data.map((o) => ({ ...o, items: (o.items as any[]) || [] })));
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

  const acceptDelivery = async (orderId: string) => {
    setAccepting(orderId);
    await supabase.from("orders").update({
      driver_id: user!.id,
      status: "driver_assigned",
    }).eq("id", orderId);
    await fetchOrders();
    setTab("active");
    setAccepting(null);
    toast.success("Delivery accepted! Navigate to restaurant for pickup. 🚗");
  };

  const handleDeliveryComplete = () => {
    fetchOrders();
    fetchCompletedOrders();
    fetchDriverProfile();
    toast.success("Delivery completed! 🎉");
  };

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
        {tab === "jobs" && (
          <DriverJobBoard
            orders={pendingOrders}
            isOnline={isOnline}
            accepting={accepting}
            onAccept={acceptDelivery}
            driverLocation={driverLocation}
          />
        )}

        {tab === "active" && (
          <DriverActiveDelivery
            orders={myOrders}
            driverLocation={driverLocation}
            onDeliveryComplete={handleDeliveryComplete}
            onStatusChange={fetchOrders}
          />
        )}

        {tab === "earnings" && (
          <DriverEarnings driverProfile={driverProfile} completedOrders={completedOrders} />
        )}

        {tab === "profile" && <DriverProfileTab />}
      </main>

      <DriverBottomNav
        activeTab={tab}
        onTabChange={setTab}
        jobCount={pendingOrders.length}
        activeCount={myOrders.length}
      />
    </div>
  );
};

export default DriverDashboard;
