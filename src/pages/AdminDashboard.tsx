import { useState, useEffect, Fragment } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield, TrendingUp, Users, ShoppingBag, Store, ArrowLeft, DollarSign, Truck, UserCheck, Search, UserPlus, Plus, Trash2, Pencil, X, Save, MapPin } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import AdminEarnings from "@/components/admin/AdminEarnings";
import AdminWithdrawals from "@/components/admin/AdminWithdrawals";
import AdminRefunds from "@/components/admin/AdminRefunds";
import { toast } from "sonner";
import { geocodeAddress } from "@/lib/geocode";

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
  driver_id: string | null;
  delivered_at: string | null;
  dispatch_phase: string | null;
  offered_to_driver_id: string | null;
  offered_to_name?: string | null;
  missed_count: number;
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
  location: string;
  lat: number | null;
  lng: number | null;
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
  driver_assigned: "bg-indigo-100 text-indigo-700",
  picking_up: "bg-indigo-100 text-indigo-700",
  arrived_at_restaurant: "bg-orange-100 text-orange-700",
  out_for_delivery: "bg-orange-100 text-orange-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_FILTERS = ["all", "pending", "in_progress", "delivered", "cancelled"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const matchesStatusFilter = (status: string, filter: StatusFilter) => {
  if (filter === "all") return true;
  if (filter === "pending") return status === "pending";
  if (filter === "delivered") return status === "delivered";
  if (filter === "cancelled") return status === "cancelled" || status === "rejected";
  // in_progress
  return ["confirmed", "preparing", "ready", "driver_assigned", "picking_up", "arrived_at_restaurant", "out_for_delivery"].includes(status);
};

const getDelayInfo = (order: { status: string; created_at: string }) => {
  if (order.status === "delivered" || order.status === "cancelled" || order.status === "rejected") return null;
  const ageMs = Date.now() - new Date(order.created_at).getTime();
  const ageMin = ageMs / 60000;
  if (ageMin >= 120) return { label: "Delayed >2h", className: "bg-red-100 text-red-700" };
  if (ageMin >= 60) return { label: "Delayed >1h", className: "bg-amber-100 text-amber-700" };
  return null;
};

const AdminDashboard = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overview" | "orders" | "earnings" | "withdrawals" | "refunds" | "users" | "restaurants" | "drivers">("overview");
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    if (!authLoading && (!user || role !== 'admin')) {
      navigate("/");
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (!user || role !== 'admin') return;
    fetchAll();

    // Real-time subscription for live order updates
    const channel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
      supabase.from("orders").select("total, status, created_at, order_number, customer_name, restaurant, payment_method, id, driver_id, delivered_at, dispatch_phase, offered_to_driver_id, missed_by_driver_ids")
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

      // Look up offeree names for active dispatch rows
      const offereeIds = Array.from(new Set(
        orders.map((o: any) => o.offered_to_driver_id).filter(Boolean)
      )) as string[];
      let nameMap = new Map<string, string>();
      if (offereeIds.length > 0) {
        const { data: offereeProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", offereeIds);
        nameMap = new Map((offereeProfiles || []).map(p => [p.user_id, p.full_name || ""]));
      }

      const enriched: RecentOrder[] = (orders as any[]).map(o => ({
        ...o,
        offered_to_name: o.offered_to_driver_id ? (nameMap.get(o.offered_to_driver_id) || null) : null,
        missed_count: Array.isArray(o.missed_by_driver_ids) ? o.missed_by_driver_ids.length : 0,
      }));

      setRecentOrders(enriched.slice(0, 10));
      setAllOrders(enriched);
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

  const tabs = ["overview", "orders", "earnings", "withdrawals", "refunds", "users", "restaurants", "drivers"] as const;

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
            <div className="mb-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by customer name or order #..."
                className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="mb-4 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                    statusFilter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {f.replace("_", " ")}
                </button>
              ))}
            </div>
            <OrdersTable orders={allOrders.filter(o => {
              if (!matchesStatusFilter(o.status, statusFilter)) return false;
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              return o.customer_name?.toLowerCase().includes(q) || String(o.order_number).includes(q);
            })} />
          </>
        )}

        {/* Earnings Tab */}
        {tab === "earnings" && <AdminEarnings drivers={drivers} />}

        {/* Withdrawals Tab */}
        {tab === "withdrawals" && <AdminWithdrawals drivers={drivers} />}

        {/* Refunds Tab */}
        {tab === "refunds" && <AdminRefunds />}

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
          <RestaurantsTab
            restaurants={restaurants}
            onToggleActive={toggleRestaurantActive}
            onRestaurantChanged={() => { fetchRestaurants(); fetchStats(); }}
          />
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

// Helper to create user via edge function (doesn't log admin out)
const adminCreateUser = async (payload: Record<string, any>) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const res = await supabase.functions.invoke("admin-create-user", {
    body: payload,
  });
  if (res.error) throw new Error(res.error.message || "Failed to create user");
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
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
      await adminCreateUser({
        email, password, full_name: fullName, contact_number: contact,
        role: "driver", vehicle_type: vehicleType, license_plate: licensePlate,
      });
      toast.success(`Driver ${fullName} registered successfully!`);
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

// Restaurant management component
const RestaurantsTab = ({
  restaurants,
  onToggleActive,
  onRestaurantChanged,
}: {
  restaurants: RestaurantRecord[];
  onToggleActive: (id: string, isActive: boolean) => void;
  onRestaurantChanged: () => void;
}) => {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [minOrder, setMinOrder] = useState("0");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerContact, setOwnerContact] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleAddRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Restaurant name is required"); return; }
    setSaving(true);
    try {
      // Geocode location text → lat/lng (best-effort; falls back to null on miss)
      let coords: { lat: number; lng: number } | null = null;
      if (location.trim()) {
        coords = await geocodeAddress(location.trim());
      }

      // Create restaurant first
      const { data: newRestaurant, error } = await supabase.from("restaurants").insert({
        name: name.trim(),
        cuisine: cuisine.trim(),
        location: location.trim(),
        description: description.trim(),
        min_order: Number(minOrder) || 0,
        owner_user_id: null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      }).select("id").single();
      if (error) throw error;

      // If login credentials provided, create a restaurant user account
      if (ownerEmail && ownerPassword) {
        try {
          await adminCreateUser({
            email: ownerEmail, password: ownerPassword,
            full_name: ownerName || name.trim(), contact_number: ownerContact,
            role: "restaurant", restaurant_id: newRestaurant.id,
          });
          toast.success(`${name} added with login: ${ownerEmail}`);
        } catch (userErr: any) {
          toast.error(`Restaurant added but login failed: ${userErr.message}`);
        }
      } else {
        toast.success(`${name} added successfully!`);
      }
      if (location.trim() && !coords) {
        toast.warning("Could not auto-locate this address. Dispatch will fall back to most-recently-active driver until coordinates are set.");
      }

      setShowForm(false);
      setName(""); setCuisine(""); setLocation(""); setDescription(""); setMinOrder("0");
      setOwnerEmail(""); setOwnerPassword(""); setOwnerName(""); setOwnerContact("");
      onRestaurantChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to add restaurant");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, restaurantName: string) => {
    if (!confirm(`Delete "${restaurantName}"? This will also remove all its menu items. This cannot be undone.`)) return;
    setDeleting(id);
    try {
      // Delete menu items first, then restaurant
      await supabase.from("menu_items").delete().eq("restaurant_id", id);
      const { error } = await supabase.from("restaurants").delete().eq("id", id);
      if (error) throw error;
      toast.success(`${restaurantName} deleted`);
      onRestaurantChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete restaurant");
    }
    setDeleting(null);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-foreground">🍽️ Restaurants ({restaurants.length})</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3.5 w-3.5" />
          {showForm ? "Cancel" : "Add Restaurant"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddRestaurant} className="mb-4 rounded-2xl border-2 border-primary bg-card p-4 shadow-card space-y-3">
          <h3 className="font-bold text-sm text-foreground">New Restaurant</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} required
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Cuisine</label>
              <input value={cuisine} onChange={e => setCuisine(e.target.value)} placeholder="e.g. Fast Food, African"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Location</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Bloemfontein"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Min Order (R)</label>
              <input type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} min="0"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div className="border-t border-border pt-3 mt-1">
            <h4 className="font-bold text-xs text-foreground mb-2">🔐 Restaurant Login (Optional)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Owner Name</label>
                <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Restaurant manager name"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Owner Contact</label>
                <input value={ownerContact} onChange={e => setOwnerContact(e.target.value)} placeholder="Phone number"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Email</label>
                <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="login@restaurant.com"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Password</label>
                <input type="password" value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)} placeholder="Min 6 characters" minLength={6}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity">
            {saving ? "Adding..." : "Add Restaurant"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {restaurants.map(r => (
          <RestaurantCard
            key={r.id}
            restaurant={r}
            onToggleActive={onToggleActive}
            onDelete={handleDelete}
            deleting={deleting}
            onRestaurantChanged={onRestaurantChanged}
          />
        ))}
      </div>
    </>
  );
};

// Individual restaurant card with inline edit
const RestaurantCard = ({
  restaurant: r,
  onToggleActive,
  onDelete,
  deleting,
  onRestaurantChanged,
}: {
  restaurant: RestaurantRecord;
  onToggleActive: (id: string, isActive: boolean) => void;
  onDelete: (id: string, name: string) => void;
  deleting: string | null;
  onRestaurantChanged: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [editContact, setEditContact] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [ownerInfo, setOwnerInfo] = useState<{ email: string; full_name: string; contact_number: string } | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(false);

  const loadOwnerInfo = async () => {
    if (!r.owner_user_id) {
      setOwnerInfo(null);
      return;
    }
    setLoadingOwner(true);
    // Get profile info
    const { data: profile } = await supabase.from("profiles").select("full_name, contact_number").eq("user_id", r.owner_user_id).single();
    // We can't get email from client, but we show profile info
    setOwnerInfo({
      email: "", // will be shown as "current email on file"
      full_name: profile?.full_name || "",
      contact_number: profile?.contact_number || "",
    });
    setEditName(profile?.full_name || "");
    setEditContact(profile?.contact_number || "");
    setLoadingOwner(false);
  };

  const handleEdit = async () => {
    if (!editing) {
      setEditing(true);
      setEditEmail("");
      setEditPassword("");
      await loadOwnerInfo();
      return;
    }
    setEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!r.owner_user_id) {
      toast.error("No owner account linked to this restaurant");
      return;
    }
    setSavingEdit(true);
    try {
      const payload: Record<string, any> = { user_id: r.owner_user_id };
      if (editEmail.trim()) payload.email = editEmail.trim();
      if (editPassword.trim()) payload.password = editPassword.trim();
      if (editName.trim()) payload.full_name = editName.trim();
      if (editContact.trim()) payload.contact_number = editContact.trim();

      const res = await supabase.functions.invoke("admin-update-user", { body: payload });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast.success(`${r.name} credentials updated!`);
      setEditing(false);
      setEditEmail("");
      setEditPassword("");
      onRestaurantChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to update credentials");
    }
    setSavingEdit(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div>
          <h3 className="font-bold text-sm text-foreground">{r.name}</h3>
          <p className="text-xs text-muted-foreground">{r.cuisine} · ⭐ {r.rating}</p>
          {r.owner_user_id && (
            <p className="text-[10px] text-primary mt-0.5">🔐 Has login</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEdit}
            className={`rounded-xl p-1.5 transition-colors ${
              editing ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
            title="Edit credentials"
          >
            {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onToggleActive(r.id, r.is_active)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
              r.is_active
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-red-100 text-red-600 hover:bg-red-200"
            }`}
          >
            {r.is_active ? "Active" : "Inactive"}
          </button>
          <button
            onClick={() => onDelete(r.id, r.name)}
            disabled={deleting === r.id}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
            title="Delete restaurant"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {editing && (
        <div className="border-t border-border bg-secondary/30 p-4 space-y-3">
          {loadingOwner ? (
            <div className="flex justify-center py-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !r.owner_user_id ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              No login account linked. Add one when creating the restaurant or assign an owner first.
            </p>
          ) : (
            <>
              <h4 className="font-bold text-xs text-foreground">Edit Login Credentials</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Owner Name</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Contact</label>
                  <input value={editContact} onChange={e => setEditContact(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">New Email (leave blank to keep)</label>
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="new@email.com"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">New Password (leave blank to keep)</label>
                  <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="••••••" minLength={6}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                <Save className="h-3.5 w-3.5" />
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
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
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Driver</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Total</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Payment</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Status</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Ordered</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Delivered</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-xs">No orders</td>
            </tr>
          ) : (
            orders.map((order, i) => {
              const showDispatch = !order.driver_id && order.dispatch_phase != null;
              const phaseStyles: Record<string, string> = {
                offer_a: "bg-blue-100 text-blue-700",
                offer_b: "bg-indigo-100 text-indigo-700",
                waiting: "bg-amber-100 text-amber-700",
                broadcast: "bg-fuchsia-100 text-fuchsia-700",
              };
              const phaseLabels: Record<string, string> = {
                offer_a: "Offer 1/2",
                offer_b: "Offer 2/2",
                waiting: "Waiting (5min)",
                broadcast: "Broadcast",
              };
              return (
                <Fragment key={order.id}>
                  <tr className={`border-b border-border ${i % 2 === 0 ? '' : 'bg-secondary/30'} ${showDispatch ? '!border-b-0' : ''}`}>
                    <td className="px-3 py-2.5 font-bold text-foreground">#{order.order_number}</td>
                    <td className="px-3 py-2.5 text-foreground text-xs">{order.customer_name || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{order.restaurant || "—"}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {order.driver_id ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Assigned</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-primary">R{order.total}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                        order.payment_method === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {order.payment_method === 'online' ? '💳' : '💵'} {order.payment_method || 'cash'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusColors[order.status] || "bg-muted text-muted-foreground"}`}>
                          {order.status.replace(/_/g, " ")}
                        </span>
                        {(() => {
                          const delay = getDelayInfo(order);
                          return delay ? (
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${delay.className}`}>
                              ⏰ {delay.label}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(order.created_at).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {order.delivered_at ? (
                        <span className="text-emerald-600 font-medium">
                          {new Date(order.delivered_at).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                  {showDispatch && (
                    <tr key={`${order.id}-dispatch`} className={`border-b border-border ${i % 2 === 0 ? '' : 'bg-secondary/30'}`}>
                      <td colSpan={9} className="px-3 pb-2 pt-0">
                        <div className="flex flex-wrap items-center gap-2 text-[10px]">
                          <span className="font-semibold text-muted-foreground uppercase tracking-wide">Dispatch:</span>
                          <span className={`rounded-full px-2 py-0.5 font-bold ${phaseStyles[order.dispatch_phase!] || "bg-muted text-muted-foreground"}`}>
                            {phaseLabels[order.dispatch_phase!] || order.dispatch_phase}
                          </span>
                          {order.offered_to_driver_id && (
                            <span className="text-muted-foreground">
                              → <span className="font-semibold text-foreground">{order.offered_to_name || "Driver"}</span>
                            </span>
                          )}
                          {order.missed_count > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">
                              {order.missed_count} missed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default AdminDashboard;
