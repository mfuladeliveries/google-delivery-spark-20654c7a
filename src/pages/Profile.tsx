import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, User, Phone, MapPin, Save, LogOut, Package, ChevronRight, Wallet } from "lucide-react";
import { storeInfo } from "@/data/menu";
import BottomNav from "@/components/BottomNav";
import { useCustomerCredits } from "@/hooks/useCustomerCredits";
import WalletHistory from "@/components/WalletHistory";
import AppSwitcher from "@/components/AppSwitcher";
import SavedAddressManager from "@/components/SavedAddressManager";
import { getHomeRouteForRoles } from "@/lib/homeRoute";

interface Profile {
  full_name: string;
  contact_number: string;
  address: string;
}

interface Order {
  id: string;
  order_number: number;
  restaurant: string;
  total: number;
  status: string;
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

const Profile = () => {
  const { user, role, roles, signOut, loading: authLoading } = useAuth();
  const { balance: walletBalance } = useCustomerCredits();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>({ full_name: "", contact_number: "", address: "" });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: prof }, { data: orders }] = await Promise.all([
        supabase.from("profiles").select("full_name, contact_number, address").eq("user_id", user.id).single(),
        supabase.from("orders").select("id, order_number, restaurant, total, status, created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
      ]);
      if (prof) setProfile({ full_name: prof.full_name || "", contact_number: prof.contact_number || "", address: prof.address || "" });
      if (orders) setRecentOrders(orders as Order[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({
      full_name: profile.full_name.trim(),
      contact_number: profile.contact_number.trim(),
      address: profile.address.trim(),
    }).eq("user_id", user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Back arrow goes to the user's own home (driver/restaurant/admin/customer)
  const homeRoute = getHomeRouteForRoles(roles);

  if (authLoading || loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl shadow-card">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to={homeRoute} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-bold text-base text-foreground">My Profile</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4 pb-nav md:pb-8 space-y-4">
        {/* Avatar + email */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-7 w-7" />
          </div>
          <div>
            <p className="font-bold text-foreground">{profile.full_name || "Your Name"}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary capitalize">{role}</span>
          </div>
        </div>

        {/* App Switcher (only renders for users with 2+ roles) */}
        <AppSwitcher />

        {/* Wallet balance */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-4 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wallet balance</p>
                <p className="text-2xl font-bold text-foreground">{storeInfo.currency}{walletBalance.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Credits from cancelled orders apply automatically at checkout.
          </p>
        </div>

        {/* Wallet history */}
        <WalletHistory />

        {/* Profile Form */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
          <h2 className="font-bold text-sm text-foreground">Personal Details</h2>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <User className="h-3 w-3" /> Full Name
            </label>
            <input
              value={profile.full_name}
              onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
              placeholder="Your full name"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Phone className="h-3 w-3" /> Contact Number
            </label>
            <input
              value={profile.contact_number}
              onChange={e => setProfile(p => ({ ...p, contact_number: e.target.value }))}
              placeholder="e.g. 072 123 4567"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MapPin className="h-3 w-3" /> Default Delivery Address
            </label>
            <div className="flex gap-2">
              <input
                value={profile.address}
                onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
                placeholder="Street address, area"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!navigator.geolocation) return;
                  setLocating(true);
                  navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
                        const data = await res.json();
                        if (data.display_name) setProfile(p => ({ ...p, address: data.display_name }));
                      } catch { /* ignore */ }
                      setLocating(false);
                    },
                    () => setLocating(false),
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                }}
                disabled={locating}
                className="flex items-center justify-center rounded-xl border border-border bg-card px-3 text-primary hover:bg-secondary transition-colors disabled:opacity-50"
                title="Use my location"
              >
                {locating ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
              saved
                ? "bg-green-500 text-white"
                : "bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98]"
            } disabled:opacity-50`}
          >
            <Save className="h-4 w-4" />
            {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {/* Recent Orders */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-foreground">Recent Orders</h2>
            <Link to="/orders" className="flex items-center gap-0.5 text-xs font-semibold text-primary">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Package className="mx-auto h-8 w-8 opacity-40 mb-2" />
              <p className="text-sm">No orders yet</p>
              <Link to="/" className="mt-1 inline-block text-xs text-primary hover:underline">Start ordering →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map(order => (
                <Link
                  key={order.id}
                  to="/orders"
                  className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 hover:border-primary/30 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">Order #{order.order_number}</p>
                    <p className="text-xs text-muted-foreground">🍽️ {order.restaurant}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{storeInfo.currency}{order.total}</p>
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${statusColors[order.status] || "bg-muted text-muted-foreground"}`}>
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Delivery areas */}
        <div className="rounded-2xl border border-border bg-primary/5 p-4">
          <p className="text-xs font-semibold text-primary mb-1">📍 Delivery Areas</p>
          <p className="text-xs text-muted-foreground">{storeInfo.areas}</p>
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Profile;
