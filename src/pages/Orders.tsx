import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Clock, Package, CheckCircle, Truck, ChefHat, AlertCircle, ShieldCheck } from "lucide-react";
import { storeInfo } from "@/data/menu";
import BottomNav from "@/components/BottomNav";
import OrderTrackingMap from "@/components/OrderTrackingMap";

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
}

const statusConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  pending: { label: "Order Placed", icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
  confirmed: { label: "Confirmed", icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-100" },
  preparing: { label: "Preparing", icon: ChefHat, color: "text-purple-600", bg: "bg-purple-100" },
  ready: { label: "Ready for Pickup", icon: Package, color: "text-cyan-600", bg: "bg-cyan-100" },
  out_for_delivery: { label: "On the Way", icon: Truck, color: "text-primary", bg: "bg-primary/10" },
  delivered: { label: "Delivered", icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" },
  cancelled: { label: "Cancelled", icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

const statusOrder = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"];

const Orders = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) {
        setOrders(
          data.map((o) => ({
            ...o,
            items: (o.items as unknown as OrderItem[]) || [],
            delivery_code: (o as any).delivery_code || "",
            customer_address: o.customer_address || "",
          }))
        );
      }
      setLoading(false);
    };
    fetchOrders();

    const channel = supabase
      .channel('customer-orders')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setOrders(prev => prev.map(o =>
          o.id === payload.new.id
            ? { ...o, status: (payload.new as any).status }
            : o
        ));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

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
          <Link to="/" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
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
            <Link to="/" className="mt-2 inline-block text-sm text-primary hover:underline">
              Start ordering →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const sc = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = sc.icon;
              const currentStep = statusOrder.indexOf(order.status);
              const isActive = order.status === "out_for_delivery";

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

                  {/* Progress bar */}
                  {order.status !== "cancelled" && (
                    <div className="flex px-4 pt-3 gap-1">
                      {statusOrder.map((s, i) => (
                        <div
                          key={s}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i <= currentStep ? "bg-primary" : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-foreground text-base">Order #{order.order_number}</span>
                      <span className="text-sm text-muted-foreground">🍽️ {order.restaurant}</span>
                    </div>

                    {/* Delivery verification code */}
                    {order.delivery_code && order.status !== "delivered" && order.status !== "cancelled" && (
                      <div className="mb-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-xs text-muted-foreground">Delivery Code</p>
                          <p className="text-lg font-bold tracking-[0.3em] text-primary">{order.delivery_code}</p>
                        </div>
                        <p className="ml-auto text-[10px] text-muted-foreground max-w-[120px] text-right">
                          Share this code with your driver to confirm delivery
                        </p>
                      </div>
                    )}

                    {/* Live GPS Map for active deliveries */}
                    {isActive && (
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

                    <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-bold text-foreground">
                      <span>Total {order.tip > 0 && `(incl. R${order.tip} tip)`}</span>
                      <span className="text-primary">{storeInfo.currency}{order.total}</span>
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
