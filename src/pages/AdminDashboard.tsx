import { useState, useEffect, Fragment } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield, TrendingUp, Users, ShoppingBag, Store, ArrowLeft, DollarSign, Truck, UserCheck, Search, UserPlus, Plus, Trash2, Pencil, X, Save, MapPin, Image as ImageIcon, Clock as ClockIcon } from "lucide-react";
import RestaurantImageManager from "@/components/admin/RestaurantImageManager";
import BottomNav from "@/components/BottomNav";
import AdminEarnings from "@/components/admin/AdminEarnings";
import AdminWithdrawals from "@/components/admin/AdminWithdrawals";
import AdminRefunds from "@/components/admin/AdminRefunds";
import AdminDriverRequests from "@/components/admin/AdminDriverRequests";
import AdminAboutEditor from "@/components/admin/AdminAboutEditor";
import AdminDeliveryFees from "@/components/admin/AdminDeliveryFees";
import AdminDeliveryAreas from "@/components/admin/AdminDeliveryAreas";
import AdminMenuManager from "@/components/admin/AdminMenuManager";
import { toast } from "sonner";
import { geocodeAddress } from "@/lib/geocode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import InstallAppButton from "@/components/InstallAppButton";
import { RestaurantName } from "@/components/RestaurantName";

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
  admin_delivery_code: string | null;
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
  logo_url: string | null;
  banner_url: string | null;
  gallery_images: string[];
  opens_at: string | null;
  closes_at: string | null;
}

interface DriverRecord {
  user_id: string;
  is_online: boolean;
  total_earnings: number;
  total_deliveries: number;
  vehicle_type?: string;
  license_plate?: string;
  service_area_id?: string | null;
  service_area_name?: string | null;
  service_area_suburb?: string | null;
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
  const [tab, setTab] = useState<"overview" | "orders" | "earnings" | "withdrawals" | "refunds" | "requests" | "users" | "restaurants" | "menus" | "drivers" | "fees" | "areas" | "about">("overview");
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
  const [cancelTarget, setCancelTarget] = useState<{ id: string; orderNumber: number } | null>(null);
  const [cancelReasonChoice, setCancelReasonChoice] = useState("Restaurant closed");
  const [cancelReasonOther, setCancelReasonOther] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || role !== 'admin')) {
      navigate("/auth");
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
      supabase.from("orders").select("total, status, created_at, order_number, customer_name, restaurant, payment_method, id, driver_id, delivered_at, dispatch_phase, offered_to_driver_id, missed_by_driver_ids, admin_delivery_code")
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

  const handleCancelOrder = (orderId: string, orderNumber: number) => {
    setCancelTarget({ id: orderId, orderNumber });
    setCancelReasonChoice("Restaurant closed");
    setCancelReasonOther("");
  };

  const submitCancelOrder = async () => {
    if (!cancelTarget) return;
    const finalReason = cancelReasonChoice === "Other"
      ? (cancelReasonOther.trim() || "Cancelled by admin")
      : cancelReasonChoice;
    setCancelSubmitting(true);
    const { error } = await supabase.rpc("admin_cancel_order", {
      p_order_id: cancelTarget.id,
      p_reason: finalReason,
    });
    setCancelSubmitting(false);
    if (error) {
      toast.error(error.message || "Failed to cancel order");
      return;
    }
    toast.success(`Order #${cancelTarget.orderNumber} cancelled`);
    setCancelTarget(null);
    fetchStats();
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
    const { data } = await supabase.from("restaurants").select("id, name, cuisine, is_active, owner_user_id, rating, location, lat, lng, logo_url, banner_url, gallery_images, opens_at, closes_at").order("name");
    if (data) setRestaurants(data as RestaurantRecord[]);
  };

  const fetchDrivers = async () => {
    const { data: driverProfiles } = await supabase.from("driver_profiles").select("user_id, is_online, total_earnings, total_deliveries, vehicle_type, license_plate, service_area_id");
    if (driverProfiles) {
      const userIds = driverProfiles.map(d => d.user_id);
      const areaIds = Array.from(new Set(driverProfiles.map(d => d.service_area_id).filter(Boolean))) as string[];
      const [{ data: profiles }, { data: areas }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, contact_number").in("user_id", userIds),
        areaIds.length
          ? supabase.from("delivery_areas").select("id, name, suburb").in("id", areaIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const areaMap = new Map((areas || []).map((a: any) => [a.id, a]));
      setDrivers(driverProfiles.map(d => {
        const area = d.service_area_id ? areaMap.get(d.service_area_id) : null;
        return {
          ...d,
          profile: profileMap.get(d.user_id) as any,
          service_area_name: area?.name ?? null,
          service_area_suburb: area?.suburb ?? null,
        };
      }));
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

  const tabs = ["overview", "orders", "earnings", "withdrawals", "refunds", "requests", "users", "restaurants", "menus", "drivers", "fees", "areas", "about"] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl shadow-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-foreground">Admin Panel</h1>
              <p className="text-[10px] text-muted-foreground">Mfula Deliveries</p>
            </div>
          </div>
          <div className="ml-auto">
            <InstallAppButton variant="admin" compact />
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
              <OrdersTable orders={recentOrders} onCancel={handleCancelOrder} />
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
            })} onCancel={handleCancelOrder} />
          </>
        )}

        {/* Earnings Tab */}
        {tab === "earnings" && <AdminEarnings drivers={drivers} />}

        {/* Withdrawals Tab */}
        {tab === "withdrawals" && <AdminWithdrawals drivers={drivers} />}

        {/* Refunds Tab */}
        {tab === "refunds" && <AdminRefunds />}

        {/* Driver access requests */}
        {tab === "requests" && <AdminDriverRequests />}

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

        {/* Menus Tab — drill into a restaurant and manage menu items */}
        {tab === "menus" && <AdminMenuManager />}

        {/* Drivers Tab */}
        {tab === "drivers" && (
          <DriversTab drivers={drivers} onDriverAdded={() => { fetchDrivers(); fetchUsers(); }} />
        )}

        {/* Delivery Fees */}
        {tab === "fees" && (
          <>
            <h2 className="font-bold text-foreground mb-3">🚚 Delivery Fees</h2>
            <AdminDeliveryFees />
          </>
        )}

        {/* Delivery Areas */}
        {tab === "areas" && <AdminDeliveryAreas />}

        {/* About Page Editor */}
        {tab === "about" && (
          <>
            <h2 className="font-bold text-foreground mb-3">ℹ️ About Page Content</h2>
            <AdminAboutEditor />
          </>
        )}
      </main>
      <BottomNav />

      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel order #{cancelTarget?.orderNumber}</DialogTitle>
            <DialogDescription>
              This will cancel the order and trigger a refund flow for online payments. The customer and any assigned driver will lose access to it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">Reason</Label>
              <Select value={cancelReasonChoice} onValueChange={setCancelReasonChoice}>
                <SelectTrigger id="cancel-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Restaurant closed">Restaurant closed</SelectItem>
                  <SelectItem value="Out of stock">Out of stock</SelectItem>
                  <SelectItem value="Customer request">Customer request</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cancelReasonChoice === "Other" && (
              <div className="space-y-1.5">
                <Label htmlFor="cancel-reason-other">Details</Label>
                <Textarea
                  id="cancel-reason-other"
                  value={cancelReasonOther}
                  onChange={(e) => setCancelReasonOther(e.target.value)}
                  placeholder="Describe the reason for cancellation..."
                  rows={3}
                  maxLength={300}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelSubmitting}>
              Keep order
            </Button>
            <Button
              variant="destructive"
              onClick={submitCancelOrder}
              disabled={cancelSubmitting || (cancelReasonChoice === "Other" && cancelReasonOther.trim().length === 0)}
            >
              {cancelSubmitting ? "Cancelling..." : "Cancel order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const [editing, setEditing] = useState<DriverRecord | null>(null);
  const [removing, setRemoving] = useState<DriverRecord | null>(null);
  const [removeMode, setRemoveMode] = useState<"revoke" | "delete">("revoke");
  const [removingBusy, setRemovingBusy] = useState(false);

  const handleRemoveDriver = async () => {
    if (!removing) return;
    setRemovingBusy(true);
    try {
      const res = await supabase.functions.invoke("admin-delete-driver", {
        body: { user_id: removing.user_id, mode: removeMode },
      });
      if (res.error) throw new Error(res.error.message || "Failed to remove driver");
      if ((res.data as any)?.error) throw new Error((res.data as any).error);
      toast.success(removeMode === "delete" ? "Driver account deleted" : "Driver access revoked");
      setRemoving(null);
      onDriverAdded();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove driver");
    }
    setRemovingBusy(false);
  };

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
        <div className="space-y-5">
          {(() => {
            const groups = new Map<string, { label: string; suburb: string | null; drivers: DriverRecord[] }>();
            for (const d of drivers) {
              const key = d.service_area_name || "__unassigned__";
              const label = d.service_area_name || "No working area";
              if (!groups.has(key)) groups.set(key, { label, suburb: d.service_area_suburb || null, drivers: [] });
              groups.get(key)!.drivers.push(d);
            }
            const sorted = Array.from(groups.values()).sort((a, b) => {
              if (a.label === "No working area") return 1;
              if (b.label === "No working area") return -1;
              return a.label.localeCompare(b.label);
            });
            return sorted.map(group => (
              <div key={group.label} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">
                    {group.label}
                    {group.suburb && <span className="ml-1 text-muted-foreground normal-case font-medium">· {group.suburb}</span>}
                  </h3>
                  <span className="text-[10px] font-bold text-muted-foreground">({group.drivers.length})</span>
                </div>
                <div className="space-y-3">
                  {group.drivers.map(d => (
                    <div key={d.user_id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-foreground truncate">{d.profile?.full_name || "Unknown"}</h3>
                          <p className="text-xs text-muted-foreground">{d.profile?.contact_number || "—"}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          d.is_online ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}>
                          {d.is_online ? "🟢 Online" : "🔴 Offline"}
                        </span>
                        <button
                          onClick={() => setEditing(d)}
                          className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-secondary transition-colors"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => setRemoving(d)}
                          className="flex items-center gap-1 rounded-lg border border-destructive/40 bg-background px-2.5 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>💰 R{d.total_earnings.toFixed(0)} earned</span>
                        <span>📦 {d.total_deliveries} deliveries</span>
                        {d.vehicle_type && <span>🚗 {d.vehicle_type}</span>}
                        {d.license_plate && <span>🔢 {d.license_plate}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      <EditDriverDialog
        driver={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); onDriverAdded(); }}
      />
    </>
  );
};

// Edit driver dialog — calls admin-update-user edge function
const EditDriverDialog = ({
  driver,
  onClose,
  onSaved,
}: {
  driver: DriverRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [licensePlate, setLicensePlate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!driver) return;
    setFullName(driver.profile?.full_name || "");
    setContactNumber(driver.profile?.contact_number || "");
    setVehicleType(driver.vehicle_type || "car");
    setLicensePlate(driver.license_plate || "");
    setEmail("");
    setPassword("");
  }, [driver]);

  const handleSave = async () => {
    if (!driver) return;
    if (!fullName.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        user_id: driver.user_id,
        full_name: fullName.trim(),
        contact_number: contactNumber.trim(),
        vehicle_type: vehicleType,
        license_plate: licensePlate.trim(),
      };
      if (email.trim()) payload.email = email.trim();
      if (password.trim()) {
        if (password.trim().length < 6) {
          toast.error("Password must be at least 6 characters");
          setSaving(false);
          return;
        }
        payload.password = password.trim();
      }
      const res = await supabase.functions.invoke("admin-update-user", { body: payload });
      if (res.error) throw new Error(res.error.message || "Failed to update driver");
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("Driver updated");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to update driver");
    }
    setSaving(false);
  };

  return (
    <Dialog open={!!driver} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit driver</DialogTitle>
          <DialogDescription>
            Update profile and vehicle details. Leave email/password blank to keep them unchanged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ed-name">Full name *</Label>
            <input id="ed-name" value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-contact">Contact number</Label>
            <input id="ed-contact" value={contactNumber} onChange={e => setContactNumber(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ed-vehicle">Vehicle type</Label>
              <select id="ed-vehicle" value={vehicleType} onChange={e => setVehicleType(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="car">Car</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="bicycle">Bicycle</option>
                <option value="scooter">Scooter</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-plate">License plate</Label>
              <input id="ed-plate" value={licensePlate} onChange={e => setLicensePlate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-border p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Login (optional)</p>
            <div className="space-y-1.5">
              <Label htmlFor="ed-email">New email</Label>
              <input id="ed-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-password">New password</Label>
              <input id="ed-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Leave blank to keep current" minLength={6}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [autoLocating, setAutoLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleAutoLocate = async () => {
    if (!location.trim()) {
      toast.error("Enter a location first, then auto-locate");
      return;
    }
    setAutoLocating(true);
    try {
      const coords = await geocodeAddress(location.trim());
      if (!coords) {
        toast.error(`Could not locate "${location}". Try a more specific address or enter coordinates manually.`);
        return;
      }
      setManualLat(coords.lat.toFixed(6));
      setManualLng(coords.lng.toFixed(6));
      toast.success(`📍 Located: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    } finally {
      setAutoLocating(false);
    }
  };

  const handleAddRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Restaurant name is required"); return; }
    setSaving(true);
    try {
      // Determine coordinates: manual entry wins, otherwise auto-geocode the location text
      let coords: { lat: number; lng: number } | null = null;
      const mLat = parseFloat(manualLat);
      const mLng = parseFloat(manualLng);
      if (!Number.isNaN(mLat) && !Number.isNaN(mLng)) {
        if (mLat < -90 || mLat > 90 || mLng < -180 || mLng > 180) {
          toast.error("Coordinates out of range (lat -90..90, lng -180..180)");
          setSaving(false);
          return;
        }
        coords = { lat: mLat, lng: mLng };
      } else if (location.trim()) {
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
      setManualLat(""); setManualLng("");
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
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-xs text-foreground">📍 Coordinates (Optional)</h4>
              <button type="button" onClick={handleAutoLocate} disabled={autoLocating || !location.trim()}
                className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/20 disabled:opacity-50">
                {autoLocating ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <MapPin className="h-3 w-3" />
                )}
                Auto-locate from location
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">Leave blank to auto-geocode the location text on save, or paste exact coordinates from Google Maps.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Latitude</label>
                <input type="number" step="any" value={manualLat} onChange={e => setManualLat(e.target.value)} placeholder="-29.0852"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Longitude</label>
                <input type="number" step="any" value={manualLng} onChange={e => setManualLng(e.target.value)} placeholder="26.1596"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
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
  const [geocoding, setGeocoding] = useState(false);
  const [coordLat, setCoordLat] = useState("");
  const [coordLng, setCoordLng] = useState("");
  const [savingCoords, setSavingCoords] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [savingHours, setSavingHours] = useState(false);

  const handleSaveHours = async () => {
    // Allow clearing both fields to remove hours
    if ((opensAt && !closesAt) || (!opensAt && closesAt)) {
      toast.error("Set both opening and closing times, or clear both.");
      return;
    }
    setSavingHours(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({
          opens_at: opensAt || null,
          closes_at: closesAt || null,
        })
        .eq("id", r.id);
      if (error) throw error;
      toast.success(
        opensAt && closesAt
          ? `⏰ ${r.name} hours: ${opensAt}–${closesAt}`
          : `⏰ ${r.name} hours cleared (always open)`
      );
      onRestaurantChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to save hours");
    }
    setSavingHours(false);
  };

  const handleSaveCoords = async () => {
    const lat = parseFloat(coordLat);
    const lng = parseFloat(coordLng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      toast.error("Enter valid numeric coordinates");
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error("Out of range (lat -90..90, lng -180..180)");
      return;
    }
    setSavingCoords(true);
    try {
      const { error } = await supabase.from("restaurants").update({ lat, lng }).eq("id", r.id);
      if (error) throw error;
      toast.success(`📍 ${r.name} coordinates saved`);
      onRestaurantChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to save coordinates");
    }
    setSavingCoords(false);
  };

  const hasCoords = r.lat !== null && r.lng !== null;

  const handleGeocode = async () => {
    if (!r.location?.trim()) {
      toast.error("This restaurant has no location text. Edit and add a location first.");
      return;
    }
    setGeocoding(true);
    try {
      const coords = await geocodeAddress(r.location.trim());
      if (!coords) {
        toast.error(`Could not locate "${r.location}". Try a more specific address.`);
        return;
      }
      const { error } = await supabase.from("restaurants").update({ lat: coords.lat, lng: coords.lng }).eq("id", r.id);
      if (error) throw error;
      toast.success(`📍 ${r.name} located: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
      onRestaurantChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to geocode");
    }
    setGeocoding(false);
  };

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
      setCoordLat(r.lat != null ? String(r.lat) : "");
      setCoordLng(r.lng != null ? String(r.lng) : "");
      // Postgres `time` returns "HH:MM:SS"; trim to "HH:MM" for <input type="time">
      setOpensAt(r.opens_at ? r.opens_at.slice(0, 5) : "");
      setClosesAt(r.closes_at ? r.closes_at.slice(0, 5) : "");
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
      <div className="flex items-center justify-between gap-3 p-4">
        {/* Logo + Banner thumbnails */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative h-12 w-12 overflow-hidden rounded-full border border-border bg-muted">
            {r.logo_url ? (
              <img
                src={r.logo_url}
                alt={`${r.name} logo`}
                className="h-full w-full object-cover transition-transform hover:scale-110"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="relative h-12 w-20 overflow-hidden rounded-lg border border-border bg-muted hidden sm:block">
            {r.banner_url ? (
              <img
                src={r.banner_url}
                alt={`${r.name} banner`}
                className="h-full w-full object-cover transition-transform hover:scale-110"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <RestaurantName as="h3" size="md" name={r.name} className="truncate" />
          <p className="text-xs text-muted-foreground">{r.cuisine} · ⭐ {r.rating}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            {r.owner_user_id && (
              <p className="text-[10px] text-primary">🔐 Has login</p>
            )}
            {hasCoords ? (
              <p className="text-[10px] text-green-600 font-semibold">📍 Located ({r.lat!.toFixed(3)}, {r.lng!.toFixed(3)})</p>
            ) : (
              <p className="text-[10px] text-amber-600 font-semibold">⚠️ No coordinates</p>
            )}
            {r.opens_at && r.closes_at ? (
              <p className="text-[10px] text-blue-600 font-semibold flex items-center gap-0.5">
                <ClockIcon className="h-2.5 w-2.5" /> {r.opens_at.slice(0, 5)}–{r.closes_at.slice(0, 5)}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground font-medium">⏰ No hours set</p>
            )}
            {r.gallery_images?.length > 0 && (
              <p className="text-[10px] text-muted-foreground font-medium">🖼️ {r.gallery_images.length} gallery</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setImagesOpen(true)}
            className="rounded-xl bg-primary/10 p-1.5 text-primary hover:bg-primary/20 transition-colors"
            title="Manage images"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleGeocode}
            disabled={geocoding}
            className={`rounded-xl p-1.5 transition-colors disabled:opacity-50 ${
              hasCoords ? "text-muted-foreground hover:bg-secondary" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
            }`}
            title={hasCoords ? "Re-geocode location" : "Geocode location (backfill coordinates)"}
          >
            {geocoding ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
          </button>
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
        <div className="border-t border-border bg-secondary/30 p-4 space-y-4">
          {/* Coordinates editor — always available */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-foreground">📍 Coordinates</h4>
              <button
                type="button"
                onClick={handleGeocode}
                disabled={geocoding || !r.location?.trim()}
                className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                {geocoding ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <MapPin className="h-3 w-3" />
                )}
                Auto-locate from "{r.location || "—"}"
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Latitude</label>
                <input type="number" step="any" value={coordLat} onChange={e => setCoordLat(e.target.value)} placeholder="-29.0852"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Longitude</label>
                <input type="number" step="any" value={coordLng} onChange={e => setCoordLng(e.target.value)} placeholder="26.1596"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <button
              onClick={handleSaveCoords}
              disabled={savingCoords}
              className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              <Save className="h-3 w-3" />
              {savingCoords ? "Saving..." : "Save Coordinates"}
            </button>
          </div>

          {/* Operating hours editor */}
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-foreground flex items-center gap-1">
                <ClockIcon className="h-3 w-3" /> Operating Hours
              </h4>
              <span className="text-[10px] text-muted-foreground">Leave blank = always open</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Customers will see "Closed" outside these hours. Overnight hours (e.g. 18:00 → 02:00) are supported.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Opens at</label>
                <input
                  type="time"
                  value={opensAt}
                  onChange={(e) => setOpensAt(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Closes at</label>
                <input
                  type="time"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveHours}
                disabled={savingHours}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                <Save className="h-3 w-3" />
                {savingHours ? "Saving..." : "Save Hours"}
              </button>
              {(opensAt || closesAt) && (
                <button
                  type="button"
                  onClick={() => {
                    setOpensAt("");
                    setClosesAt("");
                  }}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Owner credentials editor */}
          <div className="border-t border-border pt-3">
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
                <h4 className="font-bold text-xs text-foreground mb-2">🔐 Edit Login Credentials</h4>
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
                  className="mt-3 flex items-center justify-center gap-1.5 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingEdit ? "Saving..." : "Save Credentials"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <RestaurantImageManager
        open={imagesOpen}
        onClose={() => setImagesOpen(false)}
        restaurantId={r.id}
        restaurantName={r.name}
        onSaved={onRestaurantChanged}
      />
    </div>
  );
};

// Extracted orders table component
const OrdersTable = ({ orders, onCancel }: { orders: RecentOrder[]; onCancel?: (orderId: string, orderNumber: number) => void }) => {
  const COL_COUNT = 11;
  const cancellable = (status: string) => !["delivered", "cancelled", "rejected"].includes(status);
  return (
  <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary">
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">#</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Customer</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Restaurant</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Driver</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">PIN</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Total</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Payment</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Status</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Ordered</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Delivered</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={COL_COUNT} className="px-4 py-8 text-center text-muted-foreground text-xs">No orders</td>
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
                    <td className="px-3 py-2.5 text-xs">
                      {order.restaurant ? (
                        <RestaurantName as="span" size="sm" name={order.restaurant} className="!text-xs" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {order.driver_id ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Assigned</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {order.admin_delivery_code && cancellable(order.status) ? (
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold tracking-[0.2em] text-primary">
                          {order.admin_delivery_code}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
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
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {cancellable(order.status) && onCancel ? (
                        <button
                          onClick={() => onCancel(order.id, order.order_number)}
                          className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-[10px] font-bold text-destructive hover:bg-destructive/10"
                        >
                          Cancel
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                  {showDispatch && (
                    <tr key={`${order.id}-dispatch`} className={`border-b border-border ${i % 2 === 0 ? '' : 'bg-secondary/30'}`}>
                      <td colSpan={COL_COUNT} className="px-3 pb-2 pt-0">
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
};

export default AdminDashboard;
