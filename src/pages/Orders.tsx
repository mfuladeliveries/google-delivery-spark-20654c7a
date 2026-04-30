import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Clock, Package, CheckCircle, Truck, ChefHat, AlertCircle, ShieldCheck, UserCheck, Store, Bike, Wallet, Banknote, BellRing, Bell, Star, RotateCcw, Search, X } from "lucide-react";
import { storeInfo } from "@/data/menu";
import BottomNav from "@/components/BottomNav";
import OrderTrackingMap from "@/components/OrderTrackingMap";
import { toast } from "sonner";
import { getHomeRouteForRoles } from "@/lib/homeRoute";
import { useNotificationPrefs } from "@/hooks/useNotificationPrefs";
import { Switch } from "@/components/ui/switch";
import { RestaurantName } from "@/components/RestaurantName";
import { RatingDialog } from "@/components/RatingDialog";
import { stashReorder } from "@/lib/reorder";
import { OrderChat } from "@/components/OrderChat";

interface OrderItem {
  id?: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  order_number: number;
  items: OrderItem[];
  restaurant: string;
  restaurant_id: string | null;
  driver_id: string | null;
  subtotal: number;
  tax: number;
  delivery_fee: number;
  tip: number;
  total: number;
  special_notes: string;
  status: string;
  created_at: string;
  delivery_code: string;
  customer_address: string;
  payment_method?: string;
  cancel_reason?: string | null;
  refund_status?: "pending" | "credited" | "bank_pending" | "bank_paid" | null;
  refund_method?: "credits" | "bank" | null;
  refund_amount?: number | null;
  dispatch_phase?: "offer_a" | "offer_b" | "waiting" | "broadcast" | null;
  address_tag?: string | null;
}

interface RatingTarget {
  orderId: string;
  restaurantId: string | null;
  driverId: string | null;
  restaurantName: string;
}

interface RatingRow {
  id: string;
  order_id: string;
  food_rating: number;
  driver_rating: number | null;
  comment: string | null;
  created_at: string;
}

const statusSteps = [
  { key: "pending", label: "Order Placed", icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
  { key: "confirmed", label: "Accepted", icon: Store, color: "text-blue-600", bg: "bg-blue-100" },
  { key: "preparing", label: "Preparing", icon: ChefHat, color: "text-purple-600", bg: "bg-purple-100" },
  { key: "ready", label: "Ready", icon: Package, color: "text-cyan-600", bg: "bg-cyan-100" },
  { key: "driver_assigned", label: "Driver Assigned", icon: UserCheck, color: "text-indigo-600", bg: "bg-indigo-100" },
  { key: "picking_up", label: "Heading to Restaurant", icon: Bike, color: "text-indigo-600", bg: "bg-indigo-100" },
  { key: "arrived_at_restaurant", label: "At Restaurant", icon: Store, color: "text-orange-600", bg: "bg-orange-100" },
  { key: "out_for_delivery", label: "On the Way", icon: Truck, color: "text-primary", bg: "bg-primary/10" },
  { key: "delivered", label: "Delivered", icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" },
];

const cancelledConfig = { label: "Cancelled", icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" };
const rejectedConfig = { label: "Rejected", icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" };

const getStatusConfig = (status: string) => {
  if (status === "cancelled") return cancelledConfig;
  if (status === "rejected") return rejectedConfig;
  return statusSteps.find(s => s.key === status) || statusSteps[0];
};

const getStepIndex = (status: string) => {
  const idx = statusSteps.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
};

const Orders = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const homeRoute = getHomeRouteForRoles(roles);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryPins, setDeliveryPins] = useState<Record<string, string>>({});
  const [notificationLog, setNotificationLog] = useState<Record<string, Set<string>>>({});
  const [ratedOrderIds, setRatedOrderIds] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [ratingsOpen, setRatingsOpen] = useState(false);
  const [ratingsSort, setRatingsSort] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const [ratingsPage, setRatingsPage] = useState(1);
  const [ratingsQuery, setRatingsQuery] = useState("");
  const RATINGS_PAGE_SIZE = 5;
  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);
  const { prefs, update: updatePrefs } = useNotificationPrefs();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    // Load saved delivery PINs from localStorage
    const savedPins = JSON.parse(localStorage.getItem("delivery_pins") || "{}");
    setDeliveryPins(savedPins);

    const fetchNotificationLog = async () => {
      const { data } = await supabase
        .from("order_notification_log")
        .select("order_id, notification_kind")
        .eq("user_id", user.id);
      if (data) {
        const map: Record<string, Set<string>> = {};
        data.forEach((row: any) => {
          if (!map[row.order_id]) map[row.order_id] = new Set();
          map[row.order_id].add(row.notification_kind);
        });
        setNotificationLog(map);
      }
    };

    const fetchOrders = async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) {
        setOrders(
          data.map((o: any) => ({
            ...o,
            items: (o.items as unknown as OrderItem[]) || [],
            delivery_code: o.delivery_code || "",
            customer_address: o.customer_address || "",
            restaurant_id: o.restaurant_id ?? null,
            driver_id: o.driver_id ?? null,
            dispatch_phase: o.dispatch_phase ?? null,
            address_tag: o.address_tag ?? null,
          }))
        );
        const deliveredIds = data.filter(o => o.status === "delivered" || o.status === "cancelled" || o.status === "rejected").map(o => o.id);
        if (deliveredIds.length > 0) {
          const updated = { ...savedPins };
          deliveredIds.forEach(id => delete updated[id]);
          localStorage.setItem("delivery_pins", JSON.stringify(updated));
          setDeliveryPins(updated);
        }
      }
      setLoading(false);
    };

    const fetchRatings = async () => {
      const { data } = await supabase
        .from("order_ratings")
        .select("id, order_id, food_rating, driver_rating, comment, created_at")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });
      if (data) {
        setRatings(data as RatingRow[]);
        setRatedOrderIds(new Set(data.map((r: any) => r.order_id)));
      }
    };

    fetchOrders();
    fetchNotificationLog();
    fetchRatings();

    const channel = supabase
      .channel('customer-orders')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchOrders();
        fetchNotificationLog();
      })
      .subscribe();

    const logChannel = supabase
      .channel('customer-notification-log')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_notification_log',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchNotificationLog();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(logChannel);
    };
  }, [user]);

  const handleChooseRefund = async (orderId: string, orderNumber: number, method: "credits" | "bank") => {
    const { data, error } = await supabase.rpc("customer_choose_refund", {
      p_order_id: orderId,
      p_method: method,
    });
    if (error) {
      toast.error(error.message || "Failed to process refund choice");
      return;
    }
    const result = data as { status?: string; amount?: number } | null;
    if (method === "credits") {
      toast.success(`R${Number(result?.amount || 0).toFixed(2)} added to your wallet 🎉`, {
        description: "Use it on your next order.",
      });
    } else {
      toast.success("Bank refund requested", {
        description: `R${Number(result?.amount || 0).toFixed(2)} will be refunded to your bank account within 3–5 business days.`,
        duration: 8000,
      });
    }
  };

  const handleReorder = (order: Order) => {
    if (!order.restaurant_id) {
      toast.error("This restaurant is no longer available");
      return;
    }
    const seeds = order.items
      .filter((it) => !!it.id)
      .map((it) => ({ id: it.id as string, quantity: it.quantity }));
    if (seeds.length === 0) {
      toast.error("No reorderable items in this order");
      return;
    }
    stashReorder({ restaurantId: order.restaurant_id, items: seeds });
    navigate(`/restaurant/${order.restaurant_id}`);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl shadow-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to={homeRoute} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-bold text-base text-foreground">My Orders</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 pb-nav md:pb-8">
        {/* Notification preferences */}
        <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="mb-2 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Notification preferences</h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Choose which one-shot order alerts you receive (each is sent only once per order).
          </p>
          <div className="space-y-2.5">
            <label className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">"On the way" alert</span>
              </div>
              <Switch
                checked={prefs.out_for_delivery}
                onCheckedChange={(v) => updatePrefs({ out_for_delivery: v })}
                aria-label="Toggle on-the-way notifications"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-foreground">"Cancelled" alert</span>
              </div>
              <Switch
                checked={prefs.cancelled}
                onCheckedChange={(v) => updatePrefs({ cancelled: v })}
                aria-label="Toggle cancellation notifications"
              />
            </label>
          </div>
        </div>

        {/* Your ratings history */}
        {ratings.length > 0 && (() => {
          const q = ratingsQuery.trim().toLowerCase();
          const filtered = q
            ? ratings.filter((r) => {
                const order = orders.find((o) => o.id === r.order_id);
                const name = (order?.restaurant || "").toLowerCase();
                const num = order?.order_number != null ? String(order.order_number) : "";
                const qNum = q.replace(/^#/, "");
                return name.includes(q) || num.includes(qNum);
              })
            : ratings;
          const sorted = [...filtered].sort((a, b) => {
            if (ratingsSort === "newest") return +new Date(b.created_at) - +new Date(a.created_at);
            if (ratingsSort === "oldest") return +new Date(a.created_at) - +new Date(b.created_at);
            if (ratingsSort === "highest") return b.food_rating - a.food_rating;
            return a.food_rating - b.food_rating;
          });
          const totalPages = Math.max(1, Math.ceil(sorted.length / RATINGS_PAGE_SIZE));
          const safePage = Math.min(ratingsPage, totalPages);
          const start = (safePage - 1) * RATINGS_PAGE_SIZE;
          const pageItems = sorted.slice(start, start + RATINGS_PAGE_SIZE);
          return (
          <section className="mb-4 rounded-2xl border border-border bg-card shadow-card">
            <button
              type="button"
              onClick={() => setRatingsOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              aria-expanded={ratingsOpen}
            >
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Your ratings</h2>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {ratings.length}
                </span>
              </div>
              <span className="text-xs font-semibold text-primary">
                {ratingsOpen ? "Hide" : "Show"}
              </span>
            </button>
            {ratingsOpen && (
              <>
                <div className="border-t border-border px-4 py-2.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={ratingsQuery}
                      onChange={(e) => {
                        setRatingsQuery(e.target.value);
                        setRatingsPage(1);
                      }}
                      placeholder="Search by restaurant or order #"
                      aria-label="Search ratings"
                      className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {ratingsQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setRatingsQuery("");
                          setRatingsPage(1);
                        }}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Sort by
                    <select
                      value={ratingsSort}
                      onChange={(e) => {
                        setRatingsSort(e.target.value as typeof ratingsSort);
                        setRatingsPage(1);
                      }}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      aria-label="Sort ratings"
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="highest">Highest rated</option>
                      <option value="lowest">Lowest rated</option>
                    </select>
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    {sorted.length === 0
                      ? "No matches"
                      : `Showing ${start + 1}–${Math.min(start + RATINGS_PAGE_SIZE, sorted.length)} of ${sorted.length}`}
                  </span>
                </div>
                {sorted.length === 0 && (
                  <div className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
                    No ratings match “{ratingsQuery}”.
                  </div>
                )}
                <ul className="divide-y divide-border border-t border-border">
                  {pageItems.map((r) => {
                    const order = orders.find((o) => o.id === r.order_id);
                    const restaurantName = order?.restaurant || "Order";
                    const orderNumber = order?.order_number;
                    const ratedAt = new Date(r.created_at);
                    const ratedLabel = ratedAt.toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });
                    return (
                      <li key={r.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {restaurantName}
                              {orderNumber ? (
                                <span className="ml-1 font-normal text-muted-foreground">
                                  #{orderNumber}
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Rated on {ratedLabel}
                            </p>
                          </div>
                          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            Food:
                            <span className="flex">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star
                                  key={n}
                                  className={`h-3.5 w-3.5 ${
                                    n <= r.food_rating
                                      ? "fill-primary text-primary"
                                      : "text-muted-foreground/40"
                                  }`}
                                />
                              ))}
                            </span>
                          </span>
                          {r.driver_rating ? (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              Driver:
                              <span className="flex">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <Star
                                    key={n}
                                    className={`h-3.5 w-3.5 ${
                                      n <= (r.driver_rating || 0)
                                        ? "fill-primary text-primary"
                                        : "text-muted-foreground/40"
                                    }`}
                                  />
                                ))}
                              </span>
                            </span>
                          ) : null}
                        </div>
                        {r.comment ? (
                          <p className="mt-2 rounded-lg bg-secondary/40 px-2.5 py-1.5 text-xs italic text-foreground">
                            “{r.comment}”
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setRatingsPage((p) => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-muted-foreground">
                      Page {safePage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRatingsPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
          );
        })()}

        {orders.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <Package className="mx-auto h-12 w-12 opacity-40" />
            <p className="mt-3 font-semibold text-base">No orders yet</p>
            <Link to={homeRoute} className="mt-2 inline-block text-sm text-primary hover:underline">
              Start ordering →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const sc = getStatusConfig(order.status);
              const StatusIcon = sc.icon;
              const currentStep = getStepIndex(order.status);
              // Once driver accepts, collapse tracking — banner takes over on home screen
              const driverAccepted = ["driver_assigned", "picking_up", "arrived_at_restaurant", "out_for_delivery"].includes(order.status);
              const isActive = order.status === "out_for_delivery" || order.status === "driver_assigned";
              const isCancelled = order.status === "cancelled" || order.status === "rejected";

              return (
                <div key={order.id} data-testid="order-card" data-order-id={order.id} data-order-status={order.status} className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                  {/* Status header */}
                  <div className={`flex items-center gap-2 px-4 py-3 ${sc.bg}`}>
                    <StatusIcon className={`h-4 w-4 ${sc.color}`} />
                    <span data-testid="order-status-label" className={`text-sm font-bold ${sc.color}`}>{sc.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleString("en-ZA")}
                    </span>
                  </div>

                  {/* 7-stage progress tracker — hidden once driver accepts (banner takes over) */}
                  {!isCancelled && !driverAccepted && (
                    <div className="px-4 pt-3">
                      <div className="flex gap-0.5">
                        {statusSteps.map((step, i) => (
                          <div
                            key={step.key}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                              i <= currentStep ? "bg-primary" : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <div className="mt-2 flex justify-between">
                        {statusSteps.map((step, i) => {
                          const StepIcon = step.icon;
                          const isCompleted = i <= currentStep;
                          const isCurrent = i === currentStep;
                          return (
                            <div key={step.key} className="flex flex-col items-center" style={{ width: `${100 / statusSteps.length}%` }}>
                              <div className={`flex h-6 w-6 items-center justify-center rounded-full transition-all ${
                                isCurrent ? "bg-primary text-primary-foreground scale-110" :
                                isCompleted ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                              }`}>
                                <StepIcon className="h-3 w-3" />
                              </div>
                              <span className={`mt-0.5 text-[8px] text-center leading-tight ${
                                isCurrent ? "font-bold text-primary" :
                                isCompleted ? "text-foreground" : "text-muted-foreground"
                              }`}>
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-foreground text-base">Order #{order.order_number}</span>
                      <RestaurantName as="span" size="sm" name={order.restaurant} className="truncate" />
                    </div>

                    {/* Notification delivery indicators (one-shot dedupe alerts) */}
                    {(notificationLog[order.id]?.has("customer_cancelled") || notificationLog[order.id]?.has("customer_out_for_delivery")) && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {notificationLog[order.id]?.has("customer_out_for_delivery") && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            <BellRing className="h-2.5 w-2.5" />
                            "On the way" sent
                          </span>
                        )}
                        {notificationLog[order.id]?.has("customer_cancelled") && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                            <BellRing className="h-2.5 w-2.5" />
                            "Cancelled" sent
                          </span>
                        )}
                      </div>
                    )}

                    {/* Driver notification status log — verifies each push type was sent */}
                    {(notificationLog[order.id]?.has("driver_offer_pending") ||
                      notificationLog[order.id]?.has("driver_offer_missed") ||
                      notificationLog[order.id]?.has("driver_dispatch_broadcast")) && (
                      <div className="mb-3 rounded-lg border border-border bg-secondary/40 px-3 py-2">
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <Bike className="h-3 w-3 text-primary" />
                          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            Driver notifications
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {notificationLog[order.id]?.has("driver_offer_pending") && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              <CheckCircle className="h-2.5 w-2.5" />
                              Offer push sent
                            </span>
                          )}
                          {notificationLog[order.id]?.has("driver_offer_missed") && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              <AlertCircle className="h-2.5 w-2.5" />
                              Missed-offer push sent
                            </span>
                          )}
                          {notificationLog[order.id]?.has("driver_dispatch_broadcast") && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                              <BellRing className="h-2.5 w-2.5" />
                              Broadcast push sent
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Dispatch status banner — visible while order is ready and waiting for a driver to claim it */}
                    {order.status === "ready" && !order.driver_id && (() => {
                      const phase = order.dispatch_phase;
                      const isWaiting =
                        phase === "waiting" ||
                        phase === "broadcast" ||
                        notificationLog[order.id]?.has("customer_no_driver_available");
                      const isSearching = phase === "offer_a" || phase === "offer_b";
                      const areaSuffix = order.address_tag ? ` in ${order.address_tag}` : "";
                      if (isWaiting) {
                        return (
                          <div
                            role="status"
                            aria-live="polite"
                            className="mb-3 flex items-start gap-2 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 px-3 py-2.5"
                          >
                            <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-amber-700">
                                No driver available yet
                              </p>
                              <p className="mt-0.5 text-xs text-foreground">
                                We couldn't find a driver{areaSuffix} right now. We're still trying — you'll be
                                notified as soon as a driver accepts your order.
                              </p>
                            </div>
                          </div>
                        );
                      }
                      if (isSearching) {
                        return (
                          <div
                            role="status"
                            aria-live="polite"
                            className="mb-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5"
                          >
                            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                            </span>
                            <p className="text-xs font-semibold text-foreground">
                              Looking for a driver{areaSuffix}…
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Delivery PIN shown directly under order number until delivered */}
                    {(deliveryPins[order.id] || order.delivery_code) && order.status !== "delivered" && !isCancelled && (
                      <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5">
                        <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-xs text-muted-foreground">Delivery PIN:</span>
                        <span className="text-base font-bold tracking-[0.3em] text-primary">{deliveryPins[order.id] || order.delivery_code}</span>
                        <span className="ml-auto text-[9px] text-muted-foreground">Share with driver</span>
                      </div>
                    )}

                    {/* Live GPS Map — only on this Orders page when out_for_delivery (final leg) */}
                    {isActive && order.status === "out_for_delivery" && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">📍 Live Tracking</p>
                        <OrderTrackingMap orderId={order.id} customerAddress={order.customer_address} />
                      </div>
                    )}

                    {/* Live chat with the assigned driver — available from assignment until delivered */}
                    {driverAccepted && order.driver_id && user && (
                      <div className="mb-3">
                        <OrderChat
                          orderId={order.id}
                          userId={user.id}
                          role="customer"
                          counterpartyLabel="Driver"
                        />
                      </div>
                    )}

                    <div className="space-y-1 text-sm">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-card-foreground">
                          <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                          <span className="font-medium">{storeInfo.currency}{item.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {order.special_notes && (
                      <p className="mt-2 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
                        📝 {order.special_notes}
                      </p>
                    )}

                    {/* Cancellation reason */}
                    {isCancelled && order.cancel_reason && (
                      <p className="mt-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        ❌ Reason: {order.cancel_reason}
                      </p>
                    )}

                    {/* Refund choice card for online-paid cancelled orders */}
                    {isCancelled && order.payment_method === "online" && order.refund_status === "pending" && (
                      <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                        <p className="text-sm font-bold text-foreground">
                          💰 Choose how to get your refund
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Refundable: <span className="font-bold text-primary">{storeInfo.currency}{Number(order.refund_amount || order.total).toFixed(2)}</span>
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            onClick={() => handleChooseRefund(order.id, order.order_number, "credits")}
                            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                          >
                            <Wallet className="h-3.5 w-3.5" />
                            Add to wallet (instant)
                          </button>
                          <button
                            onClick={() => handleChooseRefund(order.id, order.order_number, "bank")}
                            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-foreground hover:bg-secondary"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            Refund to bank
                          </button>
                        </div>
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          ⚠️ Bank refunds take <span className="font-semibold">3–5 business days</span> to reflect. Wallet credits are instant.
                        </p>
                      </div>
                    )}

                    {/* Refund status indicator */}
                    {isCancelled && order.refund_status === "credited" && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                        <Wallet className="h-4 w-4" />
                        <span className="font-semibold">
                          R{Number(order.refund_amount || 0).toFixed(2)} credited to your wallet
                        </span>
                      </div>
                    )}
                    {isCancelled && order.refund_status === "bank_pending" && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        <Clock className="h-4 w-4" />
                        <span className="font-semibold">
                          Bank refund of R{Number(order.refund_amount || 0).toFixed(2)} pending — 3–5 business days
                        </span>
                      </div>
                    )}
                    {isCancelled && order.refund_status === "bank_paid" && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-semibold">
                          Bank refund of R{Number(order.refund_amount || 0).toFixed(2)} sent
                        </span>
                      </div>
                    )}

                    <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-bold text-foreground">
                      <span>Total {order.tip > 0 && `(incl. R${order.tip} tip)`}</span>
                      <span className="text-primary">{storeInfo.currency}{(order.total + 15).toFixed(2)}</span>
                    </div>

                    {/* Post-delivery actions: rate + reorder */}
                    {(order.status === "delivered" || isCancelled) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {order.status === "delivered" && !ratedOrderIds.has(order.id) && (
                          <button
                            onClick={() => {
                              if (ratedOrderIds.has(order.id)) return;
                              setRatingTarget({
                                orderId: order.id,
                                restaurantId: order.restaurant_id,
                                driverId: order.driver_id,
                                restaurantName: order.restaurant,
                              });
                            }}
                            disabled={ratedOrderIds.has(order.id)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Star className="h-3.5 w-3.5" />
                            Rate order
                          </button>
                        )}
                        {order.status === "delivered" && ratedOrderIds.has(order.id) && (
                          <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                            <CheckCircle className="h-3.5 w-3.5 text-primary" />
                            Rated
                          </span>
                        )}
                        {order.restaurant_id && (
                          <button
                            onClick={() => handleReorder(order)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-foreground hover:bg-secondary"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Order again
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />

      {ratingTarget && user && (
        <RatingDialog
          open={!!ratingTarget}
          onOpenChange={(o) => { if (!o) setRatingTarget(null); }}
          orderId={ratingTarget.orderId}
          restaurantId={ratingTarget.restaurantId}
          driverId={ratingTarget.driverId}
          customerId={user.id}
          restaurantName={ratingTarget.restaurantName}
          onSaved={async () => {
            const savedId = ratingTarget.orderId;
            setRatedOrderIds((prev) => {
              const next = new Set(prev);
              next.add(savedId);
              return next;
            });
            setRatingTarget(null);
            // Refresh ratings history so the new entry shows up immediately
            if (user) {
              const { data } = await supabase
                .from("order_ratings")
                .select("id, order_id, food_rating, driver_rating, comment, created_at")
                .eq("customer_id", user.id)
                .order("created_at", { ascending: false });
              if (data) setRatings(data as RatingRow[]);
            }
            setRatingsOpen(true);
          }}
        />
      )}
    </div>
  );
};

export default Orders;
