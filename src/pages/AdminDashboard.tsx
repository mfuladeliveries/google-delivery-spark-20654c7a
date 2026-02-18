import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield, TrendingUp, Users, ShoppingBag, Store, ArrowLeft, DollarSign } from "lucide-react";
import BottomNav from "@/components/BottomNav";

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  activeUsers: number;
  totalRestaurants: number;
  pendingOrders: number;
  deliveredToday: number;
}

interface RecentOrder {
  id: string;
  order_number: number;
  customer_name: string;
  total: number;
  status: string;
  restaurant: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-purple-100 text-purple-700",
  ready: "bg-cyan-100 text-cyan-700",
  out_for_delivery: "bg-orange-100 text-orange-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const AdminDashboard = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0, totalRevenue: 0, activeUsers: 0,
    totalRestaurants: 0, pendingOrders: 0, deliveredToday: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || role !== 'admin')) {
      navigate("/");
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (!user || role !== 'admin') return;
    fetchStats();
  }, [user, role]);

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const [
      { data: orders },
      { data: restaurants },
      { data: recent },
    ] = await Promise.all([
      supabase.from("orders").select("total, status, created_at"),
      supabase.from("restaurants").select("id", { count: 'exact' }),
      supabase.from("orders").select("id, order_number, customer_name, total, status, restaurant, created_at")
        .order("created_at", { ascending: false }).limit(10),
    ]);

    if (orders) {
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      const pendingOrders = orders.filter(o => ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status)).length;
      const deliveredToday = orders.filter(o => o.status === "delivered" && o.created_at.startsWith(today)).length;
      setStats({
        totalOrders: orders.length,
        totalRevenue,
        activeUsers: 0, // would need admin query
        totalRestaurants: restaurants?.length || 0,
        pendingOrders,
        deliveredToday,
      });
    }
    if (recent) setRecentOrders(recent as RecentOrder[]);
    setLoading(false);
  };

  if (authLoading || loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  const statCards = [
    { label: "Total Revenue", value: `R${stats.totalRevenue.toFixed(0)}`, icon: DollarSign, color: "bg-green-50 text-green-600" },
    { label: "Total Orders", value: stats.totalOrders, icon: ShoppingBag, color: "bg-blue-50 text-blue-600" },
    { label: "Restaurants", value: stats.totalRestaurants, icon: Store, color: "bg-purple-50 text-purple-600" },
    { label: "Pending Orders", value: stats.pendingOrders, icon: TrendingUp, color: "bg-amber-50 text-amber-600" },
    { label: "Delivered Today", value: stats.deliveredToday, icon: Users, color: "bg-primary/10 text-primary" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl shadow-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-foreground">Admin Panel</h1>
              <p className="text-[10px] text-muted-foreground">Mfula Deliveries</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4 pb-nav md:pb-8">
        {/* Stats Grid */}
        <section className="mb-6">
          <h2 className="font-bold text-foreground mb-3">📊 Overview</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {statCards.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-xl font-bold text-foreground">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Orders */}
        <section>
          <h2 className="font-bold text-foreground mb-3">🕐 Recent Orders</h2>
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">#</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Customer</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Restaurant</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Total</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs">No orders yet</td>
                    </tr>
                  ) : (
                    recentOrders.map((order, i) => (
                      <tr key={order.id} className={`border-b border-border ${i % 2 === 0 ? '' : 'bg-secondary/30'}`}>
                        <td className="px-4 py-2.5 font-bold text-foreground">#{order.order_number}</td>
                        <td className="px-4 py-2.5 text-foreground">{order.customer_name || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{order.restaurant || "—"}</td>
                        <td className="px-4 py-2.5 font-semibold text-primary">R{order.total}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusColors[order.status] || "bg-muted text-muted-foreground"}`}>
                            {order.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
};

export default AdminDashboard;
