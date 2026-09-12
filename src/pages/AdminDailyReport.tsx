import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Download, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  buildDailyRows,
  totalDailyRows,
  toCsv,
  downloadCsv,
  type ReportOrder,
  type ReportPayout,
} from "@/lib/dailyReport";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const money = (n: number) => `R ${n.toFixed(2)}`;

const AdminDailyReport = () => {
  const navigate = useNavigate();
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 1000 * 60 * 60 * 24 * 13)));
  const [to, setTo] = useState(isoDay(new Date()));
  const [orders, setOrders] = useState<ReportOrder[]>([]);
  const [payouts, setPayouts] = useState<ReportPayout[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const start = new Date(`${from}T00:00:00.000Z`).toISOString();
    const end = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86400000).toISOString();

    const [ordersRes, payoutRes] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id,order_number,created_at,status,payment_status,payment_method,subtotal,tax,delivery_fee,tip,discount_amount,credits_applied,total,refund_status,refund_amount,promo_code,referral_code",
        )
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("driver_earnings")
        .select("order_id,driver_payout,created_at")
        .gte("created_at", start)
        .lt("created_at", end)
        .limit(2000),
    ]);

    if (ordersRes.error) toast.error("Could not load orders for this period");
    setOrders((ordersRes.data ?? []) as ReportOrder[]);
    setPayouts((payoutRes.data ?? []) as ReportPayout[]);
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => buildDailyRows(orders, payouts), [orders, payouts]);
  const totals = useMemo(() => totalDailyRows(rows), [rows]);

  const exportCsv = () => {
    if (!rows.length) {
      toast.error("Nothing to export for this period");
      return;
    }
    downloadCsv(`mfula-daily-report-${from}-to-${to}.csv`, toCsv([...rows, totals]));
    toast.success("Report downloaded");
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-sm font-bold">Daily Business Report</h1>
            <p className="text-[10px] text-muted-foreground">Orders, costs and what Mfula keeps</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5">
        <Card className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">From</label>
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">To</label>
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
          <Button size="sm" onClick={exportCsv} className="ml-auto">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </Card>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["Orders", String(totals.orders)],
              ["Gross sales", money(totals.grossSales)],
              ["Delivery income", money(totals.deliveryIncome)],
              ["Driver fees", money(totals.driverFees)],
              ["Food / restaurant cost", money(totals.foodCost)],
              ["Discounts", money(totals.discounts)],
              ["Wallet credits used", money(totals.walletCreditsUsed)],
              ["Refunds", money(totals.refunds)],
            ] as const
          ).map(([label, value]) => (
            <Card key={label} className="p-3">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
              <p className="text-sm font-bold">{value}</p>
            </Card>
          ))}
        </div>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-xs font-bold uppercase text-muted-foreground">Estimated net Mfula earnings</p>
          </div>
          <p className="mt-1 text-3xl font-bold text-primary">{money(totals.netEarnings)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Delivery income less driver fees, discounts and refunds. Food money belongs to the restaurants.
          </p>
        </Card>

        <Card className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[11px]">
            <thead className="border-b border-border bg-secondary/40 text-[10px] uppercase text-muted-foreground">
              <tr>
                {["Date", "Orders", "Delivered", "Cancelled", "Food", "Delivery", "Drivers", "Discounts", "Credits", "Refunds", "Failed pay", "Net"].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 font-bold">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.date}>
                  <td className="px-3 py-2 font-bold">{r.date}</td>
                  <td className="px-3 py-2">{r.orders}</td>
                  <td className="px-3 py-2">{r.deliveredOrders}</td>
                  <td className="px-3 py-2">{r.cancelledOrders}</td>
                  <td className="px-3 py-2">{money(r.foodCost)}</td>
                  <td className="px-3 py-2">{money(r.deliveryIncome)}</td>
                  <td className="px-3 py-2">{money(r.driverFees)}</td>
                  <td className="px-3 py-2">{money(r.discounts)}</td>
                  <td className="px-3 py-2">{money(r.walletCreditsUsed)}</td>
                  <td className="px-3 py-2">{money(r.refunds)}</td>
                  <td className="px-3 py-2">{r.failedPayments}</td>
                  <td className="px-3 py-2 font-bold text-primary">{money(r.netEarnings)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                    {loading ? "Loading…" : "No orders in this period"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
};

export default AdminDailyReport;
