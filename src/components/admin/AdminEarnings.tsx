import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, Truck, Trophy, FileDown } from "lucide-react";
import { toast } from "sonner";
import { generateMonthlyStatement } from "@/lib/monthlyStatement";

type Range = "today" | "week" | "month" | "all";

interface EarningRow {
  driver_id: string;
  driver_payout: number;
  platform_fee: number;
  delivery_fee: number;
  created_at: string;
}

interface AdminEarningsProps {
  drivers: { user_id: string; profile?: { full_name: string; contact_number: string } }[];
}

const AdminEarnings = ({ drivers }: AdminEarningsProps) => {
  const [rows, setRows] = useState<EarningRow[]>([]);
  const [range, setRange] = useState<Range>("month");
  const [loading, setLoading] = useState(true);
  const [statementDriver, setStatementDriver] = useState<{ id: string; name: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  // Build 12-month options
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
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("driver_earnings")
        .select("driver_id, driver_payout, platform_fee, delivery_fee, created_at")
        .order("created_at", { ascending: false });
      if (active && data) setRows(data as EarningRow[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("admin-earnings-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_earnings" },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const driverNameById = useMemo(
    () => new Map(drivers.map((d) => [d.user_id, d.profile?.full_name || "Unknown driver"])),
    [drivers]
  );

  const filteredRows = useMemo(() => {
    if (range === "all") return rows;
    const now = new Date();
    let from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === "week") {
      from = new Date(from);
      from.setDate(from.getDate() - from.getDay());
    } else if (range === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return rows.filter((r) => new Date(r.created_at) >= from);
  }, [rows, range]);

  const totals = useMemo(() => {
    const totalDriverPayout = filteredRows.reduce((s, r) => s + Number(r.driver_payout), 0);
    const totalPlatform = filteredRows.reduce((s, r) => s + Number(r.platform_fee), 0);
    const totalRevenue = filteredRows.reduce((s, r) => s + Number(r.delivery_fee), 0);
    return { totalDriverPayout, totalPlatform, totalRevenue, deliveries: filteredRows.length };
  }, [filteredRows]);

  const perDriver = useMemo(() => {
    const map = new Map<string, { payout: number; deliveries: number }>();
    for (const r of filteredRows) {
      const cur = map.get(r.driver_id) || { payout: 0, deliveries: 0 };
      cur.payout += Number(r.driver_payout);
      cur.deliveries += 1;
      map.set(r.driver_id, cur);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, name: driverNameById.get(id) || "Unknown", ...v }))
      .sort((a, b) => b.payout - a.payout);
  }, [filteredRows, driverNameById]);

  const ranges: { id: Range; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "all", label: "All Time" },
  ];

  const handleGenerate = async () => {
    if (!statementDriver) return;
    const opt = monthOptions.find((m) => m.key === selectedMonth);
    if (!opt) return;
    setGenerating(true);
    try {
      const [{ data: periodEarnings }, { data: priorEarnings }, { data: allWithdrawals }] =
        await Promise.all([
          supabase
            .from("driver_earnings")
            .select("order_id, driver_payout, created_at")
            .eq("driver_id", statementDriver.id)
            .gte("created_at", opt.start.toISOString())
            .lt("created_at", opt.end.toISOString())
            .order("created_at", { ascending: true }),
          supabase
            .from("driver_earnings")
            .select("driver_payout")
            .eq("driver_id", statementDriver.id)
            .lt("created_at", opt.start.toISOString()),
          supabase
            .from("withdrawal_requests")
            .select("id, amount, status, requested_at, paid_at, bank_name, bank_account_number")
            .eq("driver_id", statementDriver.id)
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
        driver_name: statementDriver.name,
        period_label: opt.label,
        period_start: opt.start,
        period_end: new Date(opt.end.getTime() - 1),
        opening_balance,
        deliveries,
        withdrawals: periodWithdrawals as any,
      });
      toast.success(`${opt.label} statement downloaded`);
      setStatementDriver(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate statement");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Full driver list (including those with zero earnings in period) for statement dialog
  const allDriversList = drivers.map((d) => ({
    id: d.user_id,
    name: d.profile?.full_name || "Unknown driver",
  }));

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-bold text-foreground">💰 Earnings & Payouts</h2>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {ranges.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                range === r.id
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <DollarSign className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-foreground">R{totals.totalPlatform.toFixed(0)}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Platform commission (30%)</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-green-50 text-green-600">
            <Truck className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-foreground">R{totals.totalDriverPayout.toFixed(0)}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Driver payouts (70%)</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-foreground">R{totals.totalRevenue.toFixed(0)}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Delivery revenue</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Trophy className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-foreground">{totals.deliveries}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Completed deliveries</div>
        </div>
      </div>

      {/* Monthly statement generator */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <h3 className="mb-2 flex items-center gap-2 font-bold text-foreground">
          <FileDown className="h-4 w-4 text-primary" /> Driver Monthly Statement
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Generate a detailed PDF statement for any driver — useful for dispute resolution and support.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <select
            value={statementDriver?.id || ""}
            onChange={(e) => {
              const d = allDriversList.find((x) => x.id === e.target.value);
              setStatementDriver(d || null);
            }}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select driver…</option>
            {allDriversList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {monthOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={!statementDriver || generating}
            className="btn-glow flex items-center justify-center gap-1.5 rounded-xl gradient-maroon px-4 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            {generating ? "Generating…" : "Download"}
          </button>
        </div>
      </div>

      {/* Per-driver leaderboard */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center gap-2 border-b border-border bg-secondary px-4 py-2.5">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h3 className="text-xs font-bold text-foreground">Top Performing Drivers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">#</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Driver</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Deliveries</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Earnings</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Statement</th>
              </tr>
            </thead>
            <tbody>
              {perDriver.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No earnings in this period
                  </td>
                </tr>
              ) : (
                perDriver.map((d, i) => (
                  <tr key={d.id} className={`border-b border-border ${i % 2 === 0 ? "" : "bg-secondary/30"}`}>
                    <td className="px-4 py-2.5 font-bold text-foreground">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground">{d.name}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{d.deliveries}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-green-600">
                      R{d.payout.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setStatementDriver({ id: d.id, name: d.name })}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-bold text-foreground hover:bg-secondary"
                      >
                        <FileDown className="h-3 w-3" /> PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default AdminEarnings;
