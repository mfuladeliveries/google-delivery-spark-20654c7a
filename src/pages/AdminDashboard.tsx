import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield, TrendingUp, Users, ShoppingBag, Store, ArrowLeft, DollarSign, Truck, UserCheck, Search, UserPlus } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  totalRestaurants: number;
  pendingOrders: number;
  deliveredToday: number;
  totalDrivers: number;
}

interface RecentOrder {
  id: string;
  order_number: number;
  customer_name: string;
  total: number;
  status: string;
  restaurant: string;
  created_at: string;
  payment_method: string;
}

interface UserRecord {
  user_id: string;
  role: string;
  profile?: { full_name: string; contact_number: string };
}

interface RestaurantRecord {
  id: string;
  name: string;
  cuisine: string;
  is_active: boolean;
  owner_user_id: string | null;
  rating: number;
}

interface DriverRecord {
  user_id: string;
  is_online: boolean;
  total_earnings: number;
  total_deliveries: number;
  profile?: { full_name: string; contact_number: string };
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-purple-100 text-purple-700",
  ready: "bg-cyan-100 text-cyan-700",
  out_for_delivery: "bg-orange-100 text-orange-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  rejected: "bg-red-100 text-red-700",
};

const AdminDashboard = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overview" | "orders" | "users" | "restaurants" | "drivers">("overview");
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0, totalRevenue: 0, totalRestaurants: 0,
    pendingOrders: 0, deliveredToday: 0, totalDrivers: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [allOrders, setAllOrders] = useState<RecentOrder[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && (!user || role !== 'admin')) {
      navigate("/");
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (!user || role !== 'admin') return;
    fetchAll();
  }, [user, role]);

  const fetchAll = async () => {
    await Promise.all([fetchStats(), fetchUsers(), fetchRestaurants(), fetchDrivers()]);
    setLoading(false);
  };

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const [
      { data: orders },
      { data: restaurantList },
      { data: driverRoles },
    ] = await Promise.all([
      supabase.from("orders").select("total, status, created_at, order_number, customer_name, restaurant, payment_method, id")
        .order("created_at", { ascending: false }),
      supabase.from("restaurants").select("id", { count: 'exact' }),
      supabase.from("user_roles").select("id").eq("role", "driver"),
    ]);

    if (orders) {
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      const pendingOrders = orders.filter(o => ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status)).length;
      const deliveredToday = orders.filter(o => o.status === "delivered" && o.created_at.startsWith(today)).length;
      setStats({
        totalOrders: orders.length,
        totalRevenue,
        totalRestaurants: restaurantList?.length || 0,
        pendingOrders,
        deliveredToday,
        totalDrivers: driverRoles?.length || 0,
      });
      setRecentOrders((orders as RecentOrder[]).slice(0, 10));
      setAllOrders(orders as RecentOrder[]);
    }
  };

  const fetchUsers = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    if (roles) {
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, contact_number").in("user_id", userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      setUsers(roles.map(r => ({
        ...r,
        profile: profileMap.get(r.user_id) as any,
      })));
    }
  };

  const fetchRestaurants = async () => {
    const { data } = await supabase.from("restaurants").select("id, name, cuisine, is_active, owner_user_id, rating").order("name");
    if (data) setRestaurants(data);
  };

  const fetchDrivers = async () => {
    const { data: driverProfiles } = await supabase.from("driver_profiles").select("user_id, is_online, total_earnings, total_deliveries");
    if (driverProfiles) {
      const userIds = driverProfiles.map(d => d.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, contact_number").in("user_id", userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      setDrivers(driverProfiles.map(d => ({
        ...d,
        profile: profileMap.get(d.user_id) as any,
      })));
    }
  };

  const toggleRestaurantActive = async (id: string, isActive: boolean) => {
    await supabase.from("restaurants").update({ is_active: !isActive }).eq("id", id);
    setRestaurants(prev => prev.map(r => r.id === id ? { ...r, is_active: !isActive } : r));
    toast.success(`Restaurant ${!isActive ? 'activated' : 'deactivated'}`);
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    await supabase.from("user_roles").update({ role: newRole as any }).eq("user_id", userId);
    fetchUsers();
    toast.success("Role updated");
  };

  if (authLoading || loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  const statCards = [
    { label: "Revenue", value: `R${stats.totalRevenue.toFixed(0)}`, icon: DollarSign, color: "bg-green-50 text-green-600" },
    { label: "Orders", value: stats.totalOrders, icon: ShoppingBag, color: "bg-blue-50 text-blue-600" },
    { label: "Restaurants", value: stats.totalRestaurants, icon: Store, color: "bg-purple-50 text-purple-600" },
    { label: "Drivers", value: stats.totalDrivers, icon: Truck, color: "bg-orange-50 text-orange-600" },
    { label: "Pending", value: stats.pendingOrders, icon: TrendingUp, color: "bg-amber-50 text-amber-600" },
    { label: "Today", value: stats.deliveredToday, icon: UserCheck, color: "bg-primary/10 text-primary" },
  ];

  const tabs = ["overview", "orders", "users", "restaurants", "drivers"] as const;

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
        {/* Tab bar */}
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto scrollbar-hide px-4 pb-2">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4 pb-nav md:pb-8">
        {/* Overview Tab */}
        {tab === "overview" && (
          <>
            <section className="mb-6">
              <h2 className="font-bold text-foreground mb-3">📊 Overview</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {statCards.map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-2xl border border-border bg-card p-3 shadow-card">
                    <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-xl font-bold text-foreground">{value}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-bold text-foreground mb-3">🕐 Recent Orders</h2>
              <OrdersTable orders={recentOrders} />
            </section>
          </>
        )}

        {/* Orders Tab */}
        {tab === "orders" && (
          <>
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by customer name or order #..."
                className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <OrdersTable orders={allOrders.filter(o => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              return o.customer_name?.toLowerCase().includes(q) || String(o.order_number).includes(q);
            })} />
          </>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <>
            <h2 className="font-bold text-foreground mb-3">👥 All Users ({users.length})</h2>
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Name</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Contact</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Role</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.user_id} className={`border-b border-border ${i % 2 ? 'bg-secondary/30' : ''}`}>
                        <td className="px-4 py-2.5 font-medium text-foreground">{u.profile?.full_name || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{u.profile?.contact_number || "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            u.role === 'driver' ? 'bg-orange-100 text-orange-700' :
                            u.role === 'restaurant' ? 'bg-blue-100 text-blue-700' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            value={u.role}
                            onChange={e => updateUserRole(u.user_id, e.target.value)}
                            className="rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="customer">Customer</option>
                            <option value="driver">Driver</option>
                            <option value="restaurant">Restaurant</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Restaurants Tab */}
        {tab === "restaurants" && (
          <>
            <h2 className="font-bold text-foreground mb-3">🍽️ Restaurants ({restaurants.length})</h2>
            <div className="space-y-3">
              {restaurants.map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{r.name}</h3>
                    <p className="text-xs text-muted-foreground">{r.cuisine} · ⭐ {r.rating}</p>
                  </div>
                  <button
                    onClick={() => toggleRestaurantActive(r.id, r.is_active)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      r.is_active
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-red-100 text-red-600 hover:bg-red-200"
                    }`}
                  >
                    {r.is_active ? "Active" : "Inactive"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Drivers Tab */}
        {tab === "drivers" && (
          <DriversTab drivers={drivers} onDriverAdded={() => { fetchDrivers(); fetchUsers(); }} />
        )}
      </main>
      <BottomNav />
    </div>
  );
};

// Driver registration + listing component
const DriversTab = ({ drivers, onDriverAdded }: { drivers: DriverRecord[]; onDriverAdded: () => void }) => {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [contact, setContact] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [licensePlate, setLicensePlate] = useState("");
  const [registering, setRegistering] = useState(false);

  const handleRegisterDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast.error("Please fill in all required fields");
      return;
    }
    setRegistering(true);
    try {
      // Create the user account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error("Failed to create user");

      const newUserId = signUpData.user.id;

      // Update profile
      await supabase.from("profiles").update({
        full_name: fullName,
        contact_number: contact,
      }).eq("user_id", newUserId);

      // Set role to driver (remove default customer role, add driver)
      await supabase.from("user_roles").update({ role: "driver" as any }).eq("user_id", newUserId);

      // Update driver profile with vehicle info
      await supabase.from("driver_profiles").update({
        vehicle_type: vehicleType,
        license_plate: licensePlate,
      }).eq("user_id", newUserId);

      toast.success(`Driver ${fullName} registered! They'll need to verify their email.`);
      setShowForm(false);
      setEmail(""); setPassword(""); setFullName(""); setContact(""); setLicensePlate("");
      onDriverAdded();
    } catch (err: any) {
      toast.error(err.message || "Failed to register driver");
    }
    setRegistering(false);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-foreground">🚗 Drivers ({drivers.length})</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {showForm ? "Cancel" : "Register Driver"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleRegisterDriver} className="mb-4 rounded-2xl border-2 border-primary bg-card p-4 shadow-card space-y-3">
          <h3 className="font-bold text-sm text-foreground">New Driver Registration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Full Name *</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} required
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Password *</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Contact Number</label>
              <input value={contact} onChange={e => setContact(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Vehicle Type</label>
              <select value={vehicleType} onChange={e => setVehicleType(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="car">Car</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="bicycle">Bicycle</option>
                <option value="scooter">Scooter</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">License Plate</label>
              <input value={licensePlate} onChange={e => setLicensePlate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <button type="submit" disabled={registering}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity">
            {registering ? "Registering..." : "Register Driver"}
          </button>
        </form>
      )}

      {drivers.length === 0 && !showForm ? (
        <div className="py-12 text-center text-muted-foreground">
          <Truck className="mx-auto h-10 w-10 opacity-40 mb-2" />
          <p className="font-semibold">No drivers registered yet</p>
          <p className="text-sm mt-1">Click "Register Driver" to add one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drivers.map(d => (
            <div key={d.user_id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-foreground">{d.profile?.full_name || "Unknown"}</h3>
                  <p className="text-xs text-muted-foreground">{d.profile?.contact_number || "—"}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  d.is_online ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                }`}>
                  {d.is_online ? "🟢 Online" : "🔴 Offline"}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span>💰 R{d.total_earnings.toFixed(0)} earned</span>
                <span>📦 {d.total_deliveries} deliveries</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// Extracted orders table component
const OrdersTable = ({ orders }: { orders: RecentOrder[] }) => (
  <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary">
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">#</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Customer</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Restaurant</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Total</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Payment</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Status</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Time</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-xs">No orders</td>
            </tr>
          ) : (
            orders.map((order, i) => (
              <tr key={order.id} className={`border-b border-border ${i % 2 === 0 ? '' : 'bg-secondary/30'}`}>
                <td className="px-3 py-2.5 font-bold text-foreground">#{order.order_number}</td>
                <td className="px-3 py-2.5 text-foreground text-xs">{order.customer_name || "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{order.restaurant || "—"}</td>
                <td className="px-3 py-2.5 font-semibold text-primary">R{order.total}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    order.payment_method === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {order.payment_method === 'online' ? '💳' : '💵'} {order.payment_method || 'cash'}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusColors[order.status] || "bg-muted text-muted-foreground"}`}>
                    {order.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default AdminDashboard;
