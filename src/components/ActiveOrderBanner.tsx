import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, Bike, Store, Truck, UserCheck, X, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ActiveOrder {
  id: string;
  order_number: number;
  status: string;
  restaurant: string;
  driver_id: string | null;
  delivery_code: string | null;
}

const ACTIVE_STATUSES = ["driver_assigned", "picking_up", "arrived_at_restaurant", "out_for_delivery"];

const statusMeta: Record<string, { label: string; eta: string; Icon: any }> = {
  driver_assigned: { label: "Driver accepted", eta: "Heading to restaurant", Icon: UserCheck },
  picking_up: { label: "Driver en route", eta: "~10 min to pickup", Icon: Bike },
  arrived_at_restaurant: { label: "Driver at restaurant", eta: "Picking up your order", Icon: Store },
  out_for_delivery: { label: "On the way to you", eta: "~15 min", Icon: Truck },
};

const HIDDEN_ROUTES = ["/orders", "/auth", "/driver", "/restaurant", "/admin", "/install", "/reset-password"];

const ActiveOrderBanner = () => {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState<ActiveOrder | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Only show for plain customers (not on driver/restaurant/admin pages)
  const isProviderRole = roles?.some((r) => r === "driver" || r === "restaurant" || r === "admin");
  const onHiddenRoute = HIDDEN_ROUTES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (!user || isProviderRole) return;

    const fetchActive = async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, restaurant, driver_id, delivery_code")
        .eq("user_id", user.id)
        .in("status", ACTIVE_STATUSES)
        .order("created_at", { ascending: false })
        .limit(1);
      setOrder((data?.[0] as ActiveOrder) || null);
    };
    fetchActive();

    const channel = supabase
      .channel("active-order-banner")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `user_id=eq.${user.id}`,
      }, () => fetchActive())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isProviderRole]);

  if (!user || isProviderRole || onHiddenRoute || !order) return null;
  if (dismissed.has(order.id)) return null;

  const meta = statusMeta[order.status] || statusMeta.driver_assigned;
  const Icon = meta.Icon;

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-md px-3 md:bottom-6 animate-in slide-in-from-bottom-4">
      <div className="overflow-hidden rounded-2xl border border-primary/30 bg-card/95 shadow-lg backdrop-blur-xl">
        <button
          onClick={() => navigate("/orders")}
          className="group flex w-full items-center gap-3 px-3 py-2.5 transition-all hover:bg-secondary/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="truncate text-sm font-bold text-foreground">
              Order #{order.order_number} — {meta.label}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {order.restaurant} · {meta.eta}
            </p>
          </div>
          <MapPin className="h-5 w-5 shrink-0 text-primary group-hover:scale-110 transition-transform" />
          <span
            role="button"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              setDismissed((prev) => new Set(prev).add(order.id));
            }}
            className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        </button>

        {/* Delivery PIN — always visible while tracking so customer can share with driver */}
        {order.delivery_code && (
          <div className="flex items-center gap-2 border-t border-primary/20 bg-primary/5 px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="text-[11px] text-muted-foreground">Delivery PIN:</span>
            <span className="text-sm font-bold tracking-[0.3em] text-primary">
              {order.delivery_code}
            </span>
            <span className="ml-auto text-[9px] text-muted-foreground">Share with driver</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveOrderBanner;
