import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Clock, Package, CheckCircle, Truck, ChefHat, AlertCircle, ShieldCheck, UserCheck, Store, Bike, Wallet, Banknote, BellRing, Bell } from "lucide-react";
import { storeInfo } from "@/data/menu";
import BottomNav from "@/components/BottomNav";
import OrderTrackingMap from "@/components/OrderTrackingMap";
import { toast } from "sonner";
import { getHomeRouteForRoles } from "@/lib/homeRoute";
import { useNotificationPrefs } from "@/hooks/useNotificationPrefs";
import { Switch } from "@/components/ui/switch";

interface OrderItem {
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
    fetchOrders();
    fetchNotificationLog();

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
                <div key={order.id} className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                  {/* Status header */}
                  <div className={`flex items-center gap-2 px-4 py-3 ${sc.bg}`}>
                    <StatusIcon className={`h-4 w-4 ${sc.color}`} />
                    <span className={`text-sm font-bold ${sc.color}`}>{sc.label}</span>
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
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-foreground text-base">Order #{order.order_number}</span>
                      <span className="text-sm text-muted-foreground">🍽️ {order.restaurant}</span>
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
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Orders;
