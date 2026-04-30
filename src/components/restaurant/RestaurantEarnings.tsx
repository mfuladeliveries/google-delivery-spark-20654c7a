import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  TrendingUp,
  Receipt,
  PiggyBank,
  ArrowDownToLine,
  History,
  Info,
} from "lucide-react";

interface Props {
  restaurantId: string;
}

interface DeliveredOrder {
  id: string;
  order_number: number;
  subtotal: number;
  total: number;
  delivered_at: string | null;
  created_at: string;
}

interface WithdrawalRow {
  id: string;
  amount: number;
  status: string;
  requested_at: string;
  paid_at: string | null;
}

const FALLBACK_COMMISSION_PERCENT = 10;
const fmt = (n: number) =>
  `R${(Number.isFinite(n) ? n : 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const RestaurantEarnings = ({ restaurantId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<DeliveredOrder[]>([]);
  const [commissionPct, setCommissionPct] = useState<number>(
    FALLBACK_COMMISSION_PERCENT,
  );
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [withdrawalsSupported, setWithdrawalsSupported] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;

    const load = async () => {
      setLoading(true);

      // Commission % from app_settings (graceful fallback)
      const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("key", "platform_commission")
        .maybeSingle();
      const pct = Number(
        (settings?.value as { percent?: number } | null)?.percent,
      );
      if (Number.isFinite(pct) && pct > 0 && pct <= 100) {
        setCommissionPct(pct);
      }

      // Delivered orders for this restaurant
      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, order_number, subtotal, total, delivered_at, created_at")
        .eq("restaurant_id", restaurantId)
        .eq("status", "delivered")
        .order("delivered_at", { ascending: false });
      setOrders((ordersData ?? []) as DeliveredOrder[]);

      // Withdrawals — table may not exist yet; treat any error as "not enabled"
      const wRes = await supabase
        .from("restaurant_withdrawal_requests" as never)
        .select("id, amount, status, requested_at, paid_at")
        .eq("restaurant_id", restaurantId)
        .order("requested_at", { ascending: false })
        .limit(50);
      if (!wRes.error && Array.isArray(wRes.data)) {
        setWithdrawals(wRes.data as unknown as WithdrawalRow[]);
        setWithdrawalsSupported(true);
      } else {
        setWithdrawalsSupported(false);
      }

      setLoading(false);
    };

    load();
  }, [restaurantId]);

  const stats = useMemo(() => {
    const totalSales = orders.reduce((s, o) => s + Number(o.subtotal || 0), 0);
    const commission = totalSales * (commissionPct / 100);
    const netEarnings = totalSales - commission;

    const paidOut = withdrawals
      .filter((w) => w.status === "paid")
      .reduce((s, w) => s + Number(w.amount || 0), 0);
    const lockedOut = withdrawals
      .filter((w) => w.status === "pending" || w.status === "approved")
      .reduce((s, w) => s + Number(w.amount || 0), 0);
    const balance = Math.max(netEarnings - paidOut - lockedOut, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = orders
      .filter((o) => {
        const d = new Date(o.delivered_at ?? o.created_at);
        return d >= today;
      })
      .reduce((s, o) => s + Number(o.subtotal || 0), 0);

    return {
      totalSales,
      commission,
      netEarnings,
      balance,
      todaySales,
      delivered: orders.length,
    };
  }, [orders, withdrawals, commissionPct]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Loading earnings…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Total Sales"
          value={fmt(stats.totalSales)}
          sub={`${stats.delivered} delivered`}
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
        />
        <MetricCard
          label={`Commission (${commissionPct}%)`}
          value={`− ${fmt(stats.commission)}`}
          sub="Platform fee"
          icon={<Receipt className="h-5 w-5 text-orange-600" />}
          accent="text-orange-600"
        />
        <MetricCard
          label="Net Earnings"
          value={fmt(stats.netEarnings)}
          sub="After commission"
          icon={<PiggyBank className="h-5 w-5 text-emerald-600" />}
          accent="text-emerald-600"
        />
        <MetricCard
          label="Available Balance"
          value={fmt(stats.balance)}
          sub="Ready to withdraw"
          icon={<Wallet className="h-5 w-5 text-primary" />}
          highlight
        />
      </div>

      {/* Today */}
      <Card className="border-none shadow-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Today's Sales
              </p>
              <p className="text-xl font-display text-foreground mt-1">
                {fmt(stats.todaySales)}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal history */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-sm text-foreground">
            <History className="h-4 w-4 text-primary" /> Withdrawal History
          </h2>
          {withdrawalsSupported && (
            <Badge variant="outline" className="text-[10px]">
              {withdrawals.length} total
            </Badge>
          )}
        </div>

        {!withdrawalsSupported ? (
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-background px-3 py-4">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">
                Payouts coming soon
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Restaurant withdrawals will appear here once the payout system
                is enabled.
              </p>
            </div>
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <ArrowDownToLine className="mx-auto h-7 w-7 opacity-40 mb-2" />
            <p className="text-xs">No withdrawals yet</p>
            <p className="text-[10px] mt-0.5">
              Once you request a payout it will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {fmt(Number(w.amount))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Requested{" "}
                    {new Date(w.requested_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {w.paid_at && (
                      <>
                        {" · Paid "}
                        {new Date(w.paid_at).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                        })}
                      </>
                    )}
                  </p>
                </div>
                <StatusPill status={w.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MetricCard = ({
  label,
  value,
  sub,
  icon,
  accent,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
  highlight?: boolean;
}) => (
  <Card
    className={`border-none shadow-card ${
      highlight ? "bg-gradient-to-br from-primary/10 to-primary/5" : ""
    }`}
  >
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p
            className={`text-lg md:text-xl font-display mt-1 truncate ${
              accent ?? "text-foreground"
            }`}
          >
            {value}
          </p>
          {sub && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
          )}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background">
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    pending: {
      label: "Pending",
      cls: "bg-amber-100 text-amber-700 border-amber-200",
    },
    approved: {
      label: "Approved",
      cls: "bg-blue-100 text-blue-700 border-blue-200",
    },
    paid: {
      label: "Paid",
      cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    rejected: {
      label: "Rejected",
      cls: "bg-destructive/10 text-destructive border-destructive/20",
    },
  };
  const v = map[status] ?? {
    label: status,
    cls: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${v.cls}`}
    >
      {v.label}
    </span>
  );
};

export default RestaurantEarnings;
