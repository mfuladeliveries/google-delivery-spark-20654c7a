import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ChefHat, Package, CheckCircle, Clock, Plus, Trash2, ArrowLeft, XCircle, ShieldCheck } from "lucide-react";
import BottomNav from "@/components/BottomNav";
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
  special_notes: string;
  created_at: string;
  delivery_code: string | null;
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  is_available: boolean;
}

interface Restaurant {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-purple-100 text-purple-700",
  ready: "bg-cyan-100 text-cyan-700",
  driver_assigned: "bg-indigo-100 text-indigo-700",
  out_for_delivery: "bg-orange-100 text-orange-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  rejected: "bg-red-100 text-red-700",
};

const statusFlow = ["confirmed", "preparing", "ready"];

const RestaurantDashboard = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"orders" | "menu">("orders");
  const [ordersTab, setOrdersTab] = useState<"incoming" | "completed">("incoming");
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", description: "", price: "", image: "", category: "" });
  const [saving, setSaving] = useState(false);
  const prevOrderCountRef = useRef(0);

  useEffect(() => {
    if (!authLoading && (!user || (role !== 'restaurant' && role !== 'admin'))) {
      navigate("/");
    }
  }, [user, role, authLoading, navigate]);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1100;
        osc2.type = "sine";
        gain2.gain.value = 0.3;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.3);
      }, 200);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchAll();

    const channel = supabase
      .channel('restaurant-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          playNotificationSound();
          toast.info("🔔 New Order!", { description: `Order #${(payload.new as any).order_number} received` });
        }
        if (restaurant?.id) {
          fetchOrdersFor(restaurant.id);
        } else if (role === 'admin') {
          fetchOrders();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, restaurant?.id]);

  const fetchAll = async () => {
    const { data: rest } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("owner_user_id", user!.id)
      .maybeSingle();
    
    if (rest) {
      setRestaurant(rest as Restaurant);
      await Promise.all([fetchOrdersFor(rest.id), fetchMenuFor(rest.id)]);
    } else if (role === 'admin') {
      await fetchOrders();
    }
    setLoading(false);
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setOrders(data.map(o => ({ ...o, items: (o.items as any[]) || [] })));
  };

  const fetchOrdersFor = async (restaurantId: string) => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });
    if (data) setOrders(data.map(o => ({ ...o, items: (o.items as any[]) || [] })));
  };

  const fetchMenuFor = async (restaurantId: string) => {
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });
    if (data) setMenuItems(data as MenuItem[]);
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  };

  const acceptOrder = async (orderId: string) => {
    await updateOrderStatus(orderId, "confirmed");
    toast.success("Order accepted!");
  };

  const rejectOrder = async (orderId: string) => {
    await updateOrderStatus(orderId, "rejected");
    toast.error("Order rejected");
  };

  const getNextStatus = (current: string) => {
    const idx = statusFlow.indexOf(current);
    if (idx >= 0 && idx < statusFlow.length - 1) return statusFlow[idx + 1];
    return null;
  };

  const addMenuItem = async () => {
    if (!restaurant || !newItem.name || !newItem.price) return;
    setSaving(true);
    const { data } = await supabase.from("menu_items").insert({
      restaurant_id: restaurant.id,
      name: newItem.name,
      description: newItem.description,
      price: parseFloat(newItem.price),
      image: newItem.image,
      category: newItem.category || "General",
    }).select().single();
    if (data) {
      setMenuItems(prev => [data as MenuItem, ...prev]);
      setNewItem({ name: "", description: "", price: "", image: "", category: "" });
      setShowAddItem(false);
    }
    setSaving(false);
  };

  const deleteMenuItem = async (itemId: string) => {
    await supabase.from("menu_items").delete().eq("id", itemId);
    setMenuItems(prev => prev.filter(i => i.id !== itemId));
  };

  const incomingOrders = orders.filter(o => !["delivered", "cancelled", "rejected"].includes(o.status));
  const completedOrders = orders.filter(o => ["delivered", "cancelled", "rejected"].includes(o.status));
  const displayOrders = ordersTab === "incoming" ? incomingOrders : completedOrders;

  if (authLoading || loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl shadow-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to="/" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <ChefHat className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-sm text-foreground">{restaurant?.name || "Restaurant"}</h1>
                <p className="text-[10px] text-muted-foreground">Dashboard</p>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            {(["orders", "menu"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4 pb-nav md:pb-8">
        {tab === "orders" ? (
          <>
            {/* Orders tab toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setOrdersTab("incoming")}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  ordersTab === "incoming" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                <Clock className="h-4 w-4" />
                Incoming ({incomingOrders.length})
              </button>
              <button
                onClick={() => setOrdersTab("completed")}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  ordersTab === "completed" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                <CheckCircle className="h-4 w-4" />
                Completed ({completedOrders.length})
              </button>
            </div>

            {displayOrders.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Package className="mx-auto h-10 w-10 opacity-40 mb-2" />
                <p className="font-semibold">No {ordersTab} orders</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayOrders.map(order => (
                  <div key={order.id} className={`rounded-2xl border bg-card p-4 shadow-card ${order.status === 'pending' ? 'border-primary border-2 animate-pulse' : 'border-border'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-bold text-foreground">Order #{order.order_number}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(order.created_at).toLocaleString("en-ZA")}
                        </p>
                        <p className="text-xs text-foreground mt-1 font-medium">{order.customer_name} · {order.customer_contact}</p>
                        <p className="text-xs text-muted-foreground">{order.customer_address}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${statusColors[order.status] || "bg-muted text-muted-foreground"}`}>
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="space-y-1 border-t border-border pt-2">
                      {order.items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                          <span className="font-medium text-foreground">R{item.price * item.quantity}</span>
                        </div>
                      ))}
                      {order.special_notes && (
                        <p className="mt-1 rounded-lg bg-secondary px-2 py-1 text-xs text-muted-foreground">📝 {order.special_notes}</p>
                      )}
                      {/* Delivery PIN */}
                      {order.delivery_code && !["delivered", "cancelled", "rejected"].includes(order.status) && (
                        <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-primary/5 border border-primary/20 px-2 py-1">
                          <ShieldCheck className="h-3 w-3 text-primary" />
                          <span className="text-[10px] text-muted-foreground">PIN:</span>
                          <span className="text-xs font-bold tracking-[0.2em] text-primary">{order.delivery_code}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-sm pt-1 border-t border-border">
                        <span>Total</span>
                        <span className="text-primary">R{order.total}</span>
                      </div>
                    </div>

                    {ordersTab === "incoming" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {/* Pending: Accept / Reject */}
                        {order.status === "pending" && (
                          <>
                            <button
                              onClick={() => acceptOrder(order.id)}
                              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                            >
                              <CheckCircle className="h-3.5 w-3.5" /> Accept Order
                            </button>
                            <button
                              onClick={() => rejectOrder(order.id)}
                              className="flex items-center gap-1.5 rounded-xl bg-destructive/10 px-4 py-2 text-xs font-bold text-destructive"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject Order
                            </button>
                          </>
                        )}
                        {/* Confirmed/Preparing: advance to next */}
                        {["confirmed", "preparing"].includes(order.status) && (
                          <>
                            {getNextStatus(order.status) && (
                              <button
                                onClick={() => updateOrderStatus(order.id, getNextStatus(order.status)!)}
                                className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                              >
                                → {getNextStatus(order.status)!.replace(/_/g, " ")}
                              </button>
                            )}
                            <button
                              onClick={() => updateOrderStatus(order.id, "cancelled")}
                              className="rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {/* Ready: waiting for driver */}
                        {order.status === "ready" && (
                          <span className="rounded-xl bg-cyan-100 px-3 py-1.5 text-xs font-bold text-cyan-700">
                            ⏳ Waiting for driver pickup (auto-assigning nearest driver...)
                          </span>
                        )}
                        {order.status === "driver_assigned" && (
                          <span className="rounded-xl bg-indigo-100 px-3 py-1.5 text-xs font-bold text-indigo-700">
                            ✅ Driver assigned — awaiting pickup
                          </span>
                        )}
                        {/* Out for delivery */}
                        {order.status === "out_for_delivery" && (
                          <span className="rounded-xl bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-700">
                            🚗 Driver is delivering
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-foreground">Menu Items ({menuItems.length})</h2>
              <button
                onClick={() => setShowAddItem(!showAddItem)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> Add Item
              </button>
            </div>

            {!restaurant && (
              <div className="rounded-2xl border border-border bg-secondary p-4 mb-4">
                <p className="text-sm text-muted-foreground font-medium">No restaurant linked to your account. Contact admin to link your restaurant.</p>
              </div>
            )}

            {showAddItem && (
              <div className="rounded-2xl border border-border bg-card p-4 mb-4 shadow-card">
                <h3 className="font-semibold text-sm text-foreground mb-3">Add New Item</h3>
                <div className="space-y-2">
                  <input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} placeholder="Item name *" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} placeholder="Description" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                  <div className="flex gap-2">
                    <input value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))} placeholder="Price (R) *" type="number" className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                    <input value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} placeholder="Category" className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <input value={newItem.image} onChange={e => setNewItem(p => ({ ...p, image: e.target.value }))} placeholder="Image URL (optional)" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                  <div className="flex gap-2 pt-1">
                    <button onClick={addMenuItem} disabled={saving || !newItem.name || !newItem.price} className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
                      {saving ? "Adding..." : "Add Item"}
                    </button>
                    <button onClick={() => setShowAddItem(false)} className="rounded-xl bg-secondary px-4 py-2 text-xs font-bold text-muted-foreground">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {menuItems.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <div className="text-4xl mb-2">🍽️</div>
                <p className="font-semibold">No menu items yet</p>
                <p className="text-sm mt-1">Add your first item above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {menuItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-lg">🍽️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-foreground truncate">{item.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-bold text-xs text-primary">R{item.price}</span>
                        <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{item.category}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteMenuItem(item.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
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

export default RestaurantDashboard;
