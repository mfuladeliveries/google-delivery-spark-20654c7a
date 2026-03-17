import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ChefHat, Package, CheckCircle, Clock, Plus, Trash2, ArrowLeft, XCircle,
  ShieldCheck, Search, Download, Filter, TrendingUp, AlertCircle, Utensils, Pencil, Save, X
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { sendPushNotification } from "@/lib/pushNotify";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FoodImageUpload from "@/components/FoodImageUpload";

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
  delivery_fee: number;
  subtotal: number;
  tax: number;
  tip: number;
  payment_method: string;
  payment_status: string;
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

interface RestaurantOption {
  id: string;
  name: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: "Pending", color: "text-muted-foreground", bg: "bg-muted", icon: "🕐" },
  confirmed: { label: "Accepted", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: "✅" },
  preparing: { label: "Preparing", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: "👨‍🍳" },
  ready: { label: "Ready for Pickup", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: "📦" },
  driver_assigned: { label: "Driver Assigned", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: "🧑‍✈️" },
  out_for_delivery: { label: "Out for Delivery", color: "text-primary", bg: "bg-primary/5 border-primary/20", icon: "🚗" },
  delivered: { label: "Delivered", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: "🎉" },
  cancelled: { label: "Cancelled", color: "text-destructive", bg: "bg-destructive/5 border-destructive/20", icon: "❌" },
  rejected: { label: "Rejected", color: "text-destructive", bg: "bg-destructive/5 border-destructive/20", icon: "🚫" },
};

const statusFlow = ["confirmed", "preparing", "ready"];

const RestaurantDashboard = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"orders" | "menu">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [allRestaurants, setAllRestaurants] = useState<RestaurantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", description: "", price: "", image: "", category: "" });
  const [saving, setSaving] = useState(false);
  const prevOrderCountRef = useRef(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "all">("all");

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
  }, [user]);

  // Realtime subscription - updates when restaurant changes
  useEffect(() => {
    if (!user) return;

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
    const { data: restList } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("owner_user_id", user!.id)
      .order("name");

    if (restList && restList.length > 0) {
      setAllRestaurants(restList);
      const first = restList[0];
      setRestaurant(first as Restaurant);
      await Promise.all([fetchOrdersFor(first.id), fetchMenuFor(first.id)]);
    } else if (role === 'admin') {
      // Admin without restaurant ownership - fetch all
      const { data: allRest } = await supabase.from("restaurants").select("id, name").order("name");
      if (allRest && allRest.length > 0) {
        setAllRestaurants(allRest);
        setRestaurant(allRest[0] as Restaurant);
        await Promise.all([fetchOrdersFor(allRest[0].id), fetchMenuFor(allRest[0].id)]);
      } else {
        await fetchOrders();
      }
    }
    setLoading(false);
  };

  const switchRestaurant = async (restId: string) => {
    const selected = allRestaurants.find(r => r.id === restId);
    if (!selected) return;
    setRestaurant(selected as Restaurant);
    setLoading(true);
    await Promise.all([fetchOrdersFor(selected.id), fetchMenuFor(selected.id)]);
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
    const order = orders.find(o => o.id === orderId);
    const oldStatus = order?.status;
    await supabase.from("orders").update({ status }).eq("id", orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    
    // Send push notification
    if (order) {
      sendPushNotification({
        order_id: orderId,
        order_number: order.order_number,
        status,
        restaurant: restaurant?.name || "",
        total: order.total,
        user_id: (order as any).user_id,
        driver_id: (order as any).driver_id || null,
        restaurant_id: restaurant?.id || null,
        old_status: oldStatus || null,
      });
    }
  };

  const acceptOrder = async (orderId: string) => {
    await updateOrderStatus(orderId, "confirmed");
    toast.success("✅ Order accepted!");
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
      toast.success("Menu item added!");
    }
    setSaving(false);
  };

  const deleteMenuItem = async (itemId: string) => {
    await supabase.from("menu_items").delete().eq("id", itemId);
    setMenuItems(prev => prev.filter(i => i.id !== itemId));
    toast.success("Item deleted");
  };

  // Metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOrders = useMemo(() => orders.filter(o => new Date(o.created_at) >= today), [orders]);
  const pendingOrders = useMemo(() => orders.filter(o => o.status === "pending"), [orders]);
  const inProgressOrders = useMemo(() => orders.filter(o => ["confirmed", "preparing", "ready", "driver_assigned", "out_for_delivery"].includes(o.status)), [orders]);
  const completedOrders = useMemo(() => orders.filter(o => o.status === "delivered"), [orders]);
  const todayRevenue = useMemo(() => todayOrders.filter(o => o.status === "delivered").reduce((sum, o) => sum + Number(o.total), 0), [todayOrders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    let result = orders;

    if (statusFilter !== "all") {
      result = result.filter(o => o.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        o.customer_name.toLowerCase().includes(q) ||
        o.order_number.toString().includes(q) ||
        o.customer_contact.includes(q)
      );
    }

    if (dateFilter === "today") {
      result = result.filter(o => new Date(o.created_at) >= today);
    } else if (dateFilter === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      result = result.filter(o => new Date(o.created_at) >= weekAgo);
    }

    return result;
  }, [orders, statusFilter, searchQuery, dateFilter]);

  // CSV Export
  const exportCSV = () => {
    const headers = ["Order #", "Date", "Delivered At", "Customer", "Contact", "Address", "Items", "Subtotal", "Tax", "Delivery Fee", "Tip", "Total", "Status", "Payment"];
    const rows = filteredOrders.map(o => [
      o.order_number,
      new Date(o.created_at).toLocaleString("en-ZA"),
      (o as any).delivered_at ? new Date((o as any).delivered_at).toLocaleString("en-ZA") : "",
      o.customer_name,
      o.customer_contact,
      o.customer_address,
      o.items.map((i: any) => `${i.quantity}x ${i.name}`).join("; "),
      o.subtotal,
      o.tax,
      o.delivery_fee,
      o.tip,
      o.total,
      o.status,
      o.payment_method,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Orders exported!");
  };

  if (authLoading || loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  const statusFilters = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "confirmed", label: "Accepted" },
    { value: "preparing", label: "Preparing" },
    { value: "ready", label: "Ready" },
    { value: "driver_assigned", label: "Driver Assigned" },
    { value: "out_for_delivery", label: "In Transit" },
    { value: "delivered", label: "Delivered" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl shadow-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to="/" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-orange shadow-orange">
                <ChefHat className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                {allRestaurants.length > 1 ? (
                  <select
                    value={restaurant?.id || ""}
                    onChange={e => switchRestaurant(e.target.value)}
                    className="font-display text-sm text-foreground bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer pr-4 -ml-1 max-w-[140px] sm:max-w-[200px]"
                  >
                    {allRestaurants.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                ) : (
                  <h1 className="font-display text-sm text-foreground">{restaurant?.name || "Restaurant"}</h1>
                )}
                <p className="text-[10px] text-muted-foreground">Management Dashboard</p>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            {(["orders", "menu"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  tab === t ? "gradient-orange text-primary-foreground shadow-orange" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {t === "orders" ? "Orders" : "Menu"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 pb-nav md:pb-8">
        {tab === "orders" ? (
          <div className="space-y-4">
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card className="border-none shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Today's Orders</p>
                      <p className="text-2xl font-display text-foreground mt-1">{todayOrders.length}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Pending</p>
                      <p className="text-2xl font-display text-foreground mt-1">{pendingOrders.length}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">In Progress</p>
                      <p className="text-2xl font-display text-foreground mt-1">{inProgressOrders.length}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                      <Clock className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Revenue Today</p>
                      <p className="text-2xl font-display text-foreground mt-1">R{todayRevenue.toFixed(0)}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search, Filter & Export */}
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer, order # or phone..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={dateFilter}
                    onChange={e => setDateFilter(e.target.value as any)}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All time</option>
                    <option value="today">Today</option>
                    <option value="week">This week</option>
                  </select>
                  <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </div>
              </div>

              {/* Status filter chips */}
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                {statusFilters.map(sf => (
                  <button
                    key={sf.value}
                    onClick={() => setStatusFilter(sf.value)}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      statusFilter === sf.value
                        ? "gradient-orange text-primary-foreground shadow-orange"
                        : "bg-secondary text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {sf.label}
                    {sf.value !== "all" && (
                      <span className="ml-1 opacity-70">
                        ({orders.filter(o => o.status === sf.value).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Package className="mx-auto h-12 w-12 opacity-30 mb-3" />
                <p className="font-semibold text-lg">No orders found</p>
                <p className="text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map(order => {
                  const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                  const isPending = order.status === "pending";

                  return (
                    <Card
                      key={order.id}
                      className={`overflow-hidden transition-all ${
                        isPending ? "border-primary border-2 ring-2 ring-primary/20 animate-pulse" : "border-border"
                      }`}
                    >
                      <CardContent className="p-0">
                        {/* Order Header */}
                        <div className="flex items-start justify-between p-4 pb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-display text-base text-foreground">#{order.order_number}</span>
                              {isPending && (
                                <Badge variant="destructive" className="text-[10px] animate-bounce">NEW</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleString("en-ZA", {
                                day: "2-digit", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit"
                              })}
                            </p>
                          </div>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${sc.bg} ${sc.color}`}>
                            <span>{sc.icon}</span> {sc.label}
                          </span>
                        </div>

                        {/* Customer Info */}
                        <div className="px-4 pb-3 border-b border-border">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                            <p className="text-sm font-semibold text-foreground">{order.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{order.customer_contact}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">📍 {order.customer_address}</p>
                        </div>

                        {/* Items Table */}
                        <div className="px-4 py-3 border-b border-border">
                          <div className="space-y-1.5">
                            {order.items.map((item: any, i: number) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-secondary text-[10px] font-bold text-secondary-foreground mr-1.5">
                                    {item.quantity}x
                                  </span>
                                  {item.name}
                                </span>
                                <span className="font-semibold text-foreground">R{(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          {order.special_notes && (
                            <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-800">
                              📝 {order.special_notes}
                            </p>
                          )}
                        </div>

                        {/* Pricing Breakdown */}
                        <div className="px-4 py-3 border-b border-border text-xs space-y-1">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Subtotal</span><span>R{Number(order.subtotal).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Tax</span><span>R{Number(order.tax).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Delivery</span><span>R{Number(order.delivery_fee).toFixed(2)}</span>
                          </div>
                          {Number(order.tip) > 0 && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>Tip</span><span>R{Number(order.tip).toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-display text-sm text-foreground pt-1 border-t border-border">
                            <span>Total</span>
                            <span className="text-primary">R{Number(order.total).toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <Badge variant="outline" className="text-[10px]">
                              {order.payment_method === "online" ? "💳 Online" : "💵 Cash"}
                            </Badge>
                            <Badge variant={order.payment_status === "paid" ? "default" : "secondary"} className="text-[10px]">
                              {order.payment_status}
                            </Badge>
                          </div>
                        </div>

                        {/* Delivery PIN */}
                        {order.delivery_code && !["delivered", "cancelled", "rejected"].includes(order.status) && (
                          <div className="px-4 py-2.5 border-b border-border">
                            <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                              <ShieldCheck className="h-4 w-4 text-primary" />
                              <span className="text-xs text-muted-foreground">Delivery PIN:</span>
                              <span className="font-display text-sm tracking-[0.25em] text-primary">{order.delivery_code}</span>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="p-4">
                          {order.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                onClick={() => acceptOrder(order.id)}
                                className="flex-1 gradient-orange text-primary-foreground shadow-orange h-12 text-sm font-display"
                              >
                                <CheckCircle className="h-5 w-5 mr-1.5" /> Accept Order
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => rejectOrder(order.id)}
                                className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 h-12 text-sm font-display"
                              >
                                <XCircle className="h-5 w-5 mr-1.5" /> Reject
                              </Button>
                            </div>
                          )}

                          {["confirmed", "preparing"].includes(order.status) && (
                            <div className="flex gap-2">
                              {getNextStatus(order.status) && (
                                <Button
                                  onClick={() => updateOrderStatus(order.id, getNextStatus(order.status)!)}
                                  className="flex-1 gradient-orange text-primary-foreground shadow-orange h-12 text-sm font-display"
                                >
                                  {order.status === "confirmed" ? "🍳 Start Preparing" : "📦 Ready for Pickup"}
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                onClick={() => updateOrderStatus(order.id, "cancelled")}
                                className="border-destructive/30 text-destructive hover:bg-destructive/10 h-12 px-4"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}

                          {order.status === "ready" && (
                            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-sm font-semibold text-emerald-700">
                                Waiting for driver pickup — broadcasted to all drivers
                              </span>
                            </div>
                          )}

                          {order.status === "driver_assigned" && (
                            <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
                              <span className="text-sm font-semibold text-blue-700">✅ Driver assigned — awaiting pickup</span>
                            </div>
                          )}

                          {order.status === "out_for_delivery" && (
                            <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
                              <span className="text-sm font-semibold text-primary">🚗 Driver is delivering to customer</span>
                            </div>
                          )}

                          {order.status === "delivered" && (
                            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 space-y-1">
                              <span className="text-sm font-semibold text-emerald-700">🎉 Order completed</span>
                              {(order as any).delivered_at && (
                                <p className="text-xs text-emerald-600">
                                  📅 Delivered: {new Date((order as any).delivered_at).toLocaleString("en-ZA", {
                                    day: "2-digit", month: "short", year: "numeric",
                                    hour: "2-digit", minute: "2-digit", second: "2-digit"
                                  })}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Menu Tab */
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-foreground">Menu Items ({menuItems.length})</h2>
              <Button onClick={() => setShowAddItem(!showAddItem)} size="sm" className="gradient-orange text-primary-foreground shadow-orange gap-1.5">
                <Plus className="h-4 w-4" /> Add Item
              </Button>
            </div>

            {!restaurant && (
              <Card className="mb-4 border-amber-200 bg-amber-50">
                <CardContent className="p-4">
                  <p className="text-sm text-amber-800 font-medium">⚠️ No restaurant linked to your account. Contact admin to link your restaurant.</p>
                </CardContent>
              </Card>
            )}

            {showAddItem && (
              <Card className="mb-4 shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Add New Menu Item</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} placeholder="Item name *" />
                  <Input value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} placeholder="Description" />
                  <div className="flex gap-2">
                    <Input value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))} placeholder="Price (R) *" type="number" className="flex-1" />
                    <Input value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} placeholder="Category" className="flex-1" />
                  </div>
                  <FoodImageUpload
                    value={newItem.image}
                    onChange={(url) => setNewItem(p => ({ ...p, image: url }))}
                    restaurantId={restaurant?.id}
                  />
                  <div className="flex gap-2 pt-1">
                    <Button onClick={addMenuItem} disabled={saving || !newItem.name || !newItem.price} className="flex-1 gradient-orange text-primary-foreground shadow-orange">
                      {saving ? "Adding..." : "Add Item"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {menuItems.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Utensils className="mx-auto h-12 w-12 opacity-30 mb-3" />
                <p className="font-semibold text-lg">No menu items yet</p>
                <p className="text-sm mt-1">Add your first item above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {menuItems.map(item => (
                  <Card key={item.id} className="shadow-card">
                    <CardContent className="flex items-center gap-3 p-3">
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
                          <span className="font-display text-xs text-primary">R{item.price}</span>
                          <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
                        </div>
                      </div>
                      <button onClick={() => deleteMenuItem(item.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </CardContent>
                  </Card>
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
