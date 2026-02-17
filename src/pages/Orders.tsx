import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Clock, Package } from "lucide-react";
import { storeInfo } from "@/data/menu";

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
}

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
        .order("created_at", { ascending: false });
      if (data) {
        setOrders(
          data.map((o) => ({
            ...o,
            items: (o.items as unknown as OrderItem[]) || [],
          }))
        );
      }
      setLoading(false);
    };
    fetchOrders();
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
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-lg font-bold text-foreground">My Orders</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {orders.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <Package className="mx-auto h-12 w-12 opacity-50" />
            <p className="mt-3 font-display font-medium">No orders yet</p>
            <Link to="/" className="mt-2 inline-block text-sm text-primary hover:underline">
              Start ordering
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-display text-lg font-bold text-foreground">
                      Order #{order.order_number}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      {new Date(order.created_at).toLocaleString("en-ZA")}
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary capitalize">
                    {order.status}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mb-2">
                  🍽️ {order.restaurant}
                </p>

                <div className="space-y-1 text-sm">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-card-foreground">
                      <span>{item.quantity}x {item.name}</span>
                      <span>{storeInfo.currency}{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                {order.special_notes && (
                  <p className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                    📝 {order.special_notes}
                  </p>
                )}

                <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-bold text-foreground">
                  <span>Total {order.tip > 0 && `(incl. R${order.tip} tip)`}</span>
                  <span className="text-primary">{storeInfo.currency}{order.total}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Orders;
