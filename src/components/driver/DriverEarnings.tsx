import { DollarSign, Package, TrendingUp, Calendar, MapPin, Clock, ChevronDown, ChevronUp, Wallet, Lock, FileDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { generateMonthlyStatement } from "@/lib/monthlyStatement";

interface Order {
  id: string;
  order_number: number;
  restaurant: string;
  delivery_fee: number;
  created_at: string;
  total: number;
  customer_address: string;
  status?: string;
}

interface DriverProfile {
  is_online: boolean;
  total_earnings: number;
  total_deliveries: number;
}

interface EarningRow {
  order_id: string;
  driver_payout: number;
  platform_fee: number;
  delivery_fee: number;
  created_at: string;
}

interface DriverEarningsProps {
  driverProfile: DriverProfile | null;
  completedOrders: Order[];
}

const MIN_WITHDRAWAL = 100;

const DriverEarnings = ({ driverProfile, completedOrders }: DriverEarningsProps) => {
  const { user } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const [earnings, setEarnings] = useState<EarningRow[]>([]);
  const [generatingStatement, setGeneratingStatement] = useState(false);

  // Month options: current + 11 previous months
  const monthOptions = useMemo(() => {
    const out: { key: string; label: string; start: Date; end: Date }[] = [];
    const base = new Date();
    for (let i = 0; i < 12; i++) {
      const start = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const end = new Date(base.getFullYear(), base.getMonth() - i + 1, 1);
      out.push({
        key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
        label: start.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }),
        start,
        end,
      });
    }
    return out;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].key);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("driver_earnings")
        .select("order_id, driver_payout, platform_fee, delivery_fee, created_at")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false });
      if (active && data) setEarnings(data as EarningRow[]);
    };

    load();

    const channel = supabase
      .channel("driver-earnings-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "driver_earnings", filter: `driver_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const earningsByOrder = new Map(earnings.map((e) => [e.order_id, e]));

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const inRange = (iso: string, from: Date) => new Date(iso) >= from;

  const todayRows = earnings.filter((e) => inRange(e.created_at, startOfToday));
  const weekRows = earnings.filter((e) => inRange(e.created_at, startOfWeek));
  const monthRows = earnings.filter((e) => inRange(e.created_at, startOfMonth));

  const sumPayout = (rows: EarningRow[]) => rows.reduce((s, r) => s + Number(r.driver_payout), 0);
  const todayEarnings = sumPayout(todayRows);
  const weekEarnings = sumPayout(weekRows);
  const monthEarnings = sumPayout(monthRows);
  const totalEarnings = sumPayout(earnings);

  const displayedOrders = showAll ? completedOrders : completedOrders.slice(0, 10);

  const handleWithdraw = () => {
    if (totalEarnings < MIN_WITHDRAWAL) {
      toast.error(`Minimum withdrawal is R${MIN_WITHDRAWAL}`);
      return;
    }
    toast.info("Withdrawals coming soon — payouts are processed weekly for now.");
  };

  const handleGenerateStatement = async () => {
    if (!user) return;
    const opt = monthOptions.find((m) => m.key === selectedMonth);
    if (!opt) return;

    setGeneratingStatement(true);
    try {
      const [{ data: profileData }, { data: periodEarnings }, { data: priorEarnings }, { data: allWithdrawals }] =
        await Promise.all([
          supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
          supabase
            .from("driver_earnings")
            .select("order_id, driver_payout, created_at")
            .eq("driver_id", user.id)
            .gte("created_at", opt.start.toISOString())
            .lt("created_at", opt.end.toISOString())
            .order("created_at", { ascending: true }),
          supabase
            .from("driver_earnings")
            .select("driver_payout")
            .eq("driver_id", user.id)
            .lt("created_at", opt.start.toISOString()),
          supabase
            .from("withdrawal_requests")
            .select("id, amount, status, requested_at, paid_at, bank_name, bank_account_number")
            .eq("driver_id", user.id)
            .order("requested_at", { ascending: true }),
        ]);

      const orderIds = (periodEarnings || []).map((e: any) => e.order_id);
      const { data: orderRows } = orderIds.length
        ? await supabase
            .from("orders")
            .select("id, order_number, restaurant, customer_address, delivered_at")
            .in("id", orderIds)
        : { data: [] as any[] };
      const orderById = new Map((orderRows || []).map((o: any) => [o.id, o]));

      const deliveries = (periodEarnings || []).map((e: any) => {
        const o = orderById.get(e.order_id);
        return {
          order_id: e.order_id,
          order_number: o?.order_number ?? null,
          restaurant: o?.restaurant ?? "—",
          customer_address: o?.customer_address ?? "—",
          delivered_at: o?.delivered_at || e.created_at,
          driver_payout: Number(e.driver_payout),
        };
      });

      const priorEarned = (priorEarnings || []).reduce((s: number, r: any) => s + Number(r.driver_payout), 0);
      const priorLocked = (allWithdrawals || [])
        .filter((w: any) => new Date(w.requested_at) < opt.start && w.status !== "rejected")
        .reduce((s: number, w: any) => s + Number(w.amount), 0);
      const opening_balance = Math.max(0, priorEarned - priorLocked);

      const periodWithdrawals = (allWithdrawals || []).filter(
        (w: any) =>
          new Date(w.requested_at) >= opt.start && new Date(w.requested_at) < opt.end
      );

      generateMonthlyStatement({
        driver_name: profileData?.full_name || "Driver",
        period_label: opt.label,
        period_start: opt.start,
        period_end: new Date(opt.end.getTime() - 1),
        opening_balance,
        deliveries,
        withdrawals: periodWithdrawals as any,
      });
      toast.success(`${opt.label} statement downloaded`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate statement");
    } finally {
      setGeneratingStatement(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hero balance card */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-[hsl(var(--driver-success)/0.15)] to-[hsl(var(--driver-success)/0.05)] p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Available Balance</p>
            <p className="mt-1 text-4xl font-bold text-foreground">R{totalEarnings.toFixed(2)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{earnings.length} delivered orders · 70% commission</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--driver-success))] text-white shadow-md">
            <Wallet className="h-7 w-7" />
          </div>
        </div>
        <button
          onClick={handleWithdraw}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-2.5 text-sm font-bold text-background transition-opacity hover:opacity-90"
        >
          <Lock className="h-3.5 w-3.5" /> Request Withdrawal (Coming soon)
        </button>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">Minimum R{MIN_WITHDRAWAL}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--driver-success)/0.1)]">
            <DollarSign className="h-4 w-4 text-[hsl(var(--driver-success))]" />
          </div>
          <p className="text-lg font-bold text-foreground">R{todayEarnings.toFixed(0)}</p>
          <p className="text-[10px] font-medium text-muted-foreground">Today</p>
          <p className="text-[9px] text-muted-foreground">{todayRows.length} deliveries</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--driver-warning)/0.1)]">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--driver-warning))]" />
          </div>
          <p className="text-lg font-bold text-foreground">R{weekEarnings.toFixed(0)}</p>
          <p className="text-[10px] font-medium text-muted-foreground">This Week</p>
          <p className="text-[9px] text-muted-foreground">{weekRows.length} deliveries</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--driver-info)/0.1)]">
            <Calendar className="h-4 w-4 text-[hsl(var(--driver-info))]" />
          </div>
          <p className="text-lg font-bold text-foreground">R{monthEarnings.toFixed(0)}</p>
          <p className="text-[10px] font-medium text-muted-foreground">This Month</p>
          <p className="text-[9px] text-muted-foreground">{monthRows.length} deliveries</p>
        </div>
      </div>

      {/* Earnings rate info */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs text-muted-foreground">
          💡 <span className="font-semibold text-foreground">How it works:</span> You earn 70% of the R55 delivery fee (R38.50) per completed order. Platform retains 30%.
        </p>
      </div>

      {/* Delivery history */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 font-bold text-foreground">
          <Package className="h-4 w-4 text-primary" /> Delivery History
        </h3>

        {completedOrders.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p className="font-semibold">No completed deliveries yet</p>
            <p className="mt-1 text-sm">Complete deliveries to see your history</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {displayedOrders.map((order) => {
                const e = earningsByOrder.get(order.id);
                const payout = e ? Number(e.driver_payout) : order.delivery_fee;
                return (
                  <div key={order.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--driver-success)/0.1)]">
                      <Package className="h-4 w-4 text-[hsl(var(--driver-success))]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">#{order.order_number}</span>
                        <span className="text-sm font-bold text-[hsl(var(--driver-success))]">+R{payout.toFixed(2)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="truncate text-[11px] text-muted-foreground">{order.restaurant}</span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(order.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-0.5 truncate text-[10px] text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" /> {order.customer_address}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {completedOrders.length > 10 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="h-3 w-3" /> Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" /> Show All ({completedOrders.length})
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DriverEarnings;
