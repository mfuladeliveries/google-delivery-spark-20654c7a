import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { sendPushNotification } from "@/lib/pushNotify";
import {
  startNotificationSound,
  stopNotificationSound,
  markOfferResponded,
  markOfferCancelled,
  cleanupNotificationListeners,
  clearOfferNotifications,
  hasOfferRung,
} from "@/lib/driverNotificationManager";
import DriverHeader from "@/components/driver/DriverHeader";
import DriverBottomNav from "@/components/driver/DriverBottomNav";
import DriverOrdersList from "@/components/driver/DriverOrdersList";
import NewOrderModal from "@/components/driver/NewOrderModal";
import DriverActiveDelivery from "@/components/driver/DriverActiveDelivery";
import DriverEarnings from "@/components/driver/DriverEarnings";
import DriverWithdrawals from "@/components/driver/DriverWithdrawals";
import DriverProfileTab from "@/components/driver/DriverProfile";
import DriverServiceArea from "@/components/driver/DriverServiceArea";
import AuthLoadingScreen from "@/components/AuthLoadingScreen";
import { MapPin } from "lucide-react";

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
  offer_expires_at?: string | null;
  offered_to_driver_id?: string | null;
  dispatch_phase?: string | null;
}

interface DriverProfile {
  is_online: boolean;
  total_earnings: number;
  total_deliveries: number;
  service_area_id?: string | null;
  is_suspended?: boolean;
  suspended_reason?: string | null;
}

type DriverTab = "orders" | "earnings" | "withdraw" | "area" | "profile";

// URL <-> tab mapping so /driver/orders, /driver/earnings, /driver/profile etc. all work as deep links
const PATH_TO_TAB: Record<string, DriverTab> = {
  "/driver": "orders",
  "/driver/": "orders",
  "/driver/dashboard": "orders",
  "/driver/orders": "orders",
  "/driver/history": "orders",
  "/driver/earnings": "earnings",
  "/driver/withdraw": "withdraw",
  "/driver/area": "area",
  "/driver/profile": "profile",
};

const TAB_TO_PATH: Record<DriverTab, string> = {
  orders: "/driver/orders",
  earnings: "/driver/earnings",
  withdraw: "/driver/withdraw",
  area: "/driver/area",
  profile: "/driver/profile",
};

const DriverDashboard = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialTab: DriverTab = PATH_TO_TAB[location.pathname] ?? "orders";
  const [tab, setTabState] = useState<DriverTab>(initialTab);
  const setTab = useCallback(
    (next: DriverTab) => {
      setTabState(next);
      const target = TAB_TO_PATH[next];
      if (location.pathname !== target) navigate(target, { replace: true });
    },
    [location.pathname, navigate],
  );

  // Keep tab in sync if user navigates via browser back/forward or a deep link
  useEffect(() => {
    const fromUrl = PATH_TO_TAB[location.pathname];
    if (fromUrl && fromUrl !== tab) setTabState(fromUrl);
  }, [location.pathname, tab]);

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
  const [consecutiveRejections, setConsecutiveRejections] = useState(0);
  const [showAvailabilityPrompt, setShowAvailabilityPrompt] = useState(false);
  const locationWatchRef = useRef<number | null>(null);
  // Track offers we've already logged a timeout for, to avoid double-logging.
  const timeoutLoggedRef = useRef<Set<string>>(new Set());

  // Bumps the consecutive-rejection counter and surfaces the soft prompt at 3.
  const bumpConsecutiveRejections = useCallback(() => {
    setConsecutiveRejections((prev) => {
      const next = prev + 1;
      if (next >= 3) {
        setShowAvailabilityPrompt(true);
        return 0;
      }
      return next;
    });
  }, []);

  // Tracks offer IDs the driver has already responded to (accept/reject) so the
  // modal can never reopen for that offer, even if realtime updates arrive late.
  const respondedOfferIdsRef = useRef<Set<string>>(new Set());
  // Synchronous tap guard — prevents double-tap race before React state flushes.
  const processingRef = useRef(false);

  // Auth + role gating is handled by <RoleGuard> in App.tsx, so this
  // component only renders once the viewer is confirmed to be a driver/admin.

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Pop modal ONLY for orders explicitly offered to this driver
  useEffect(() => {
    if (!driverProfile?.is_online || !user) return;
    if (activeOffer) return;
    const targeted = pendingOrders.find(
      (o) =>
        o.offered_to_driver_id === user.id &&
        o.offer_expires_at &&
        new Date(o.offer_expires_at).getTime() > Date.now() &&
        !respondedOfferIdsRef.current.has(o.id),
    );
    if (targeted) {
      setActiveOffer(targeted);
    }
  }, [pendingOrders, driverProfile?.is_online, activeOffer, user]);

  // Auto-dismiss the modal once the offer expires (so the chain can advance)
  useEffect(() => {
    if (!activeOffer?.offer_expires_at) return;
    const remaining = new Date(activeOffer.offer_expires_at).getTime() - Date.now();
    const expire = () => {
      const expired = activeOffer;
      setActiveOffer(null);
      // Log a timeout rejection (once per offer) and bump the consecutive counter,
      // but only if the driver hadn't already responded to it.
      if (
        expired &&
        user &&
        !respondedOfferIdsRef.current.has(expired.id) &&
        !timeoutLoggedRef.current.has(expired.id)
      ) {
        timeoutLoggedRef.current.add(expired.id);
        supabase
          .from("order_rejections")
          .insert({
            order_id: expired.id,
            driver_id: user.id,
            reason: "timeout",
            dispatch_phase: expired.dispatch_phase ?? null,
          })
          .then(() => {});
        bumpConsecutiveRejections();
      }
    };
    if (remaining <= 0) {
      expire();
      return;
    }
    const timer = setTimeout(expire, remaining);
    return () => clearTimeout(timer);
  }, [activeOffer?.offer_expires_at, activeOffer?.id, user, bumpConsecutiveRejections]);

  // Play the new-order ringtone EXACTLY ONCE per offer — keyed only on offer ID
  // so that acceptingId/rejectingId state changes never re-trigger playback.
  useEffect(() => {
    if (!activeOffer) return;
    if (respondedOfferIdsRef.current.has(activeOffer.id)) return;
    if (hasOfferRung(activeOffer.id)) return;

    startNotificationSound(activeOffer.id);

    // One-shot OS notification when the tab is hidden
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("🚗 New delivery waiting!", {
          body: `Order #${activeOffer.order_number} from ${activeOffer.restaurant} — R${activeOffer.delivery_fee} delivery fee`,
          icon: "/pwa-driver-192.png",
          tag: `offer-${activeOffer.id}`,
        } as NotificationOptions);
      } catch {
        /* ignore */
      }
    }
  }, [activeOffer?.id]); // ONLY re-run when a new offer arrives — not on state changes

  // Stop the ringtone if the modal closes, the tab is hidden, the driver goes offline,
  // or the component unmounts.
  useEffect(() => {
    if (!activeOffer) stopNotificationSound();
  }, [activeOffer]);

  useEffect(() => {
    if (!driverProfile?.is_online) {
      cleanupNotificationListeners();
    }
  }, [driverProfile?.is_online]);

  // Final cleanup: always silence audio when this screen unmounts to avoid leaks.
  useEffect(() => {
    return () => {
      cleanupNotificationListeners();
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stopNotificationSound();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", stopNotificationSound);
    window.addEventListener("beforeunload", stopNotificationSound);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", stopNotificationSound);
      window.removeEventListener("beforeunload", stopNotificationSound);
      cleanupNotificationListeners();
    };
  }, []);

  // If a targeted offer is taken by someone else / cancelled / expires server-side,
  // mark it cancelled so the manager forbids future sound for that offer id.
  useEffect(() => {
    if (!user) return;
    pendingOrders.forEach((o) => {
      const expired = o.offer_expires_at && new Date(o.offer_expires_at).getTime() <= Date.now();
      if (expired && !respondedOfferIdsRef.current.has(o.id)) {
        markOfferCancelled(o.id);
      }
    });
  }, [pendingOrders, user]);


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
        await supabase
          .from("driver_profiles")
          .update({
            current_lat: loc.lat,
            current_lng: loc.lng,
            location_updated_at: new Date().toISOString(),
          })
          .eq("user_id", user!.id);
        const activeIds = myOrders.map((o) => o.id);
        for (const id of activeIds) {
          await supabase.rpc("driver_update_order", {
            p_order_id: id,
            p_status: null,
            p_lat: loc.lat,
            p_lng: loc.lng,
          });
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
    };
  }, [user, driverProfile?.is_online, myOrders.length]);

  const fetchAll = async () => {
    await Promise.all([
      fetchOrders(),
      fetchDriverProfile(),
      fetchCompletedOrders(),
      fetchRejected(),
    ]);
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
      // Pull orders visible to me (RLS: targeted offer to me OR broadcast phase)
      (supabase as any)
        .from("driver_orders")
        .select(
          "id, order_number, restaurant, customer_address, delivery_fee, created_at, items, offer_expires_at, offered_to_driver_id, dispatch_phase",
        )
        .eq("status", "ready")
        .is("driver_id", null)
        .gte("created_at", cutoff)
        .order("created_at"),
      (supabase as any)
        .from("driver_orders")
        .select("*")
        .eq("driver_id", user!.id)
        .in("status", [
          "driver_assigned",
          "picking_up",
          "arrived_at_restaurant",
          "out_for_delivery",
        ])
        .gte("created_at", cutoff)
        .order("created_at"),
    ]);

    if (pending)
      setPendingOrders(
        (pending as any[]).map((o: any) => ({
          ...o,
          items: (o.items as any[]) || [],
          customer_name: "",
          customer_contact: "",
          status: "ready",
        })),
      );
    if (mine) setMyOrders(mine.map((o) => ({ ...o, items: (o.items as any[]) || [] })));
  };

  const fetchCompletedOrders = async () => {
    const { data } = await (supabase as any)
      .from("driver_orders")
      .select("*")
      .eq("driver_id", user!.id)
      .eq("status", "delivered")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setCompletedOrders(data.map((o: any) => ({ ...o, items: (o.items as any[]) || [] })));
  };


  const fetchDriverProfile = async () => {
    const { data } = await supabase
      .from("driver_profiles")
      .select(
        "is_online, total_earnings, total_deliveries, service_area_id, is_suspended, suspended_reason",
      )
      .eq("user_id", user!.id)
      .maybeSingle();
    if (data) {
      // Suspended drivers cannot use the app — sign them out and bounce them
      // back to the driver login with a clear message.
      if (data.is_suspended) {
        toast.error(
          data.suspended_reason
            ? `Your driver account is suspended: ${data.suspended_reason}`
            : "Your driver account is suspended. Please contact support.",
        );
        await supabase.auth.signOut();
        navigate("/driver/login", { replace: true });
        return;
      }
      setDriverProfile(data);
    } else {
      await supabase.from("driver_profiles").insert({ user_id: user!.id });
      setDriverProfile({ is_online: false, total_earnings: 0, total_deliveries: 0 });
    }
  };

  const toggleOnline = async () => {
    if (!driverProfile) return;
    const newStatus = !driverProfile.is_online;
    // Going online requires a saved working area — otherwise dispatch will skip the driver.
    if (newStatus) {
      const { data: row } = await supabase
        .from("driver_profiles")
        .select("service_area_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!row?.service_area_id) {
        toast.error("Pick your working area in the Area tab before going online");
        return;
      }
    }
    setTogglingOnline(true);
    await supabase.from("driver_profiles").update({ is_online: newStatus }).eq("user_id", user!.id);
    setDriverProfile((prev) => (prev ? { ...prev, is_online: newStatus } : prev));
    toast.success(newStatus ? "You're now online! 🟢" : "You're now offline 🔴");
    setTogglingOnline(false);

    // When a driver comes online, trigger dispatch so any pending orders that
    // were waiting (because no driver was available earlier) can be offered to
    // this driver immediately.
    if (newStatus) {
      try {
        await supabase.rpc("driver_request_dispatch");
      } catch {
        /* non-fatal — the periodic tick will pick them up shortly */
      }
      await fetchOrders();
    }
  };

  const handleAccept = async (orderId: string) => {
    // processingRef is a synchronous guard — catches double-taps before React
    // state has had a chance to flush, which is what causes the "tap twice" bug.
    if (processingRef.current) return;
    processingRef.current = true;

    const order =
      (activeOffer && activeOffer.id === orderId ? activeOffer : null) ||
      pendingOrders.find((o) => o.id === orderId);
    if (!order || respondedOfferIdsRef.current.has(orderId)) {
      processingRef.current = false;
      return;
    }

    // Mark as responded FIRST — stops sound and blocks any re-trigger from
    // realtime updates or the sound useEffect re-running.
    respondedOfferIdsRef.current.add(orderId);
    markOfferResponded(orderId);
    stopNotificationSound();
    clearOfferNotifications(orderId);

    // Close modal immediately BEFORE setting acceptingId so the button is
    // never briefly re-enabled between renders — this was the double-tap cause.
    const wasActiveOffer = activeOffer?.id === orderId ? activeOffer : null;
    setActiveOffer(null);
    setAcceptingId(orderId);

    const isTargetedToMe = order.offered_to_driver_id === user!.id;
    const rpcName = isTargetedToMe ? "driver_accept_offer" : "claim_order";
    const { data, error } = await supabase.rpc(rpcName, { p_order_id: orderId });

    if (error) {
      toast.error(error.message || "Failed to accept");
      respondedOfferIdsRef.current.delete(orderId);
      setAcceptingId(null);
      if (wasActiveOffer) {
        setActiveOffer(wasActiveOffer);
        startNotificationSound(orderId);
      }
      processingRef.current = false;
      return;
    }
    if (data === false) {
      toast.error(
        isTargetedToMe ? "Offer expired — too late!" : "Order already taken by another driver",
      );
      await fetchOrders();
      setAcceptingId(null);
      processingRef.current = false;
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
    toast.success("Order accepted successfully.");
    // Accepting an order resets the consecutive-rejection counter.
    setConsecutiveRejections(0);
    setShowAvailabilityPrompt(false);
    await fetchOrders();
    setAcceptingId(null);
    processingRef.current = false;
  };

  const handleReject = async (orderId: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    if (respondedOfferIdsRef.current.has(orderId) || rejectingId || acceptingId) {
      processingRef.current = false;
      return;
    }
    respondedOfferIdsRef.current.add(orderId);

    setRejectingId(orderId);
    markOfferResponded(orderId);
    stopNotificationSound();
    clearOfferNotifications(orderId);
    const order =
      activeOffer?.id === orderId ? activeOffer : pendingOrders.find((o) => o.id === orderId);
    const isTargetedToMe = order?.offered_to_driver_id === user!.id;

    setRejectedIds((prev) => new Set(prev).add(orderId));

    if (isTargetedToMe) {
      const { error } = await supabase.rpc("driver_decline_offer", { p_order_id: orderId });
      if (error) {
        toast.error(error.message || "Failed to decline");
        respondedOfferIdsRef.current.delete(orderId);
        setRejectingId(null);
        processingRef.current = false;
        return;
      }
      supabase
        .from("driver_rejected_orders")
        .insert({ driver_id: user!.id, order_id: orderId })
        .then(() => {});
      toast.info("Order rejected — passed to next driver");
    } else {
      const { error } = await supabase
        .from("driver_rejected_orders")
        .insert({ driver_id: user!.id, order_id: orderId });
      if (error && !error.message.includes("duplicate")) {
        toast.error("Failed to decline");
        respondedOfferIdsRef.current.delete(orderId);
        setRejectingId(null);
        processingRef.current = false;
        return;
      }
    }
    if (activeOffer?.id === orderId) setActiveOffer(null);
    setRejectingId(null);
    processingRef.current = false;
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

  // Available list = only broadcast-phase orders (targeted offers go through the modal)
  const availableOrders = useMemo(
    () => pendingOrders.filter((o) => o.dispatch_phase === "broadcast" && !rejectedIds.has(o.id)),
    [pendingOrders, rejectedIds],
  );

  const expandedOrder = expandedOrderId
    ? (myOrders.find((o) => o.id === expandedOrderId) ?? null)
    : null;

  // Auth/role loader is rendered by <RoleGuard> in App.tsx; here we
  // only need to cover the initial data fetch so the dashboard chrome
  // doesn't flash before orders/profile data is ready.
  const hasDriverAccess = !!user && (roles.includes("driver") || roles.includes("admin"));
  if (!hasDriverAccess || loading) {
    return <AuthLoadingScreen label="Loading driver dashboard…" />;
  }

  // First-time setup gate: a driver MUST pick their working area before they can
  // use the dashboard. Admins onboard the driver, but the driver chooses their area.
  const needsAreaSetup =
    !roles.includes("admin") && driverProfile != null && !driverProfile.service_area_id;

  if (needsAreaSetup) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-lg px-4 pt-8 pb-24">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <MapPin className="h-7 w-7 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Welcome! Set your working area
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Before you can go online and receive deliveries, please tell us where you'll be
              working. You can change this anytime from your Profile.
            </p>
          </div>
          <DriverServiceArea onSaved={fetchDriverProfile} />
        </div>
      </div>
    );
  }

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
                onAccept={handleAccept}
                onReject={handleReject}
                acceptingId={acceptingId}
                rejectingId={rejectingId}
              />
            )}
          </>
        )}

        {tab === "earnings" && (
          <DriverEarnings driverProfile={driverProfile} completedOrders={completedOrders} />
        )}

        {tab === "withdraw" && <DriverWithdrawals />}

        {tab === "area" && (
          <div className="space-y-3">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Working Area</h2>
              <p className="text-xs text-muted-foreground">
                Update the centre point and radius where you want to receive deliveries.
              </p>
            </div>
            <DriverServiceArea onSaved={fetchDriverProfile} />
          </div>
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
        accepting={!!acceptingId && acceptingId === activeOffer?.id}
        rejecting={!!rejectingId && rejectingId === activeOffer?.id}
        onAccept={handleAcceptOffer}
        onReject={handleRejectOffer}
      />
    </div>
  );
};

export default DriverDashboard;
