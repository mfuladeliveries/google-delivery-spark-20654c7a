import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2 } from "lucide-react";

type RangeKey = "7" | "30" | "90";

interface DriverStats {
  driverId: string;
  driverName: string;
  accepted: number;
  completed: number;
  cancelled: number;
  totalEarnings: number;
  avgEarnings: number;
  completionRate: number;
  avgPickupMin: number | null;
  avgDeliveryMin: number | null;
}

const fmtMoney = (n: number) => `R${n.toFixed(2)}`;
const fmtMin = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)} min`);

function avgMinutes(pairs: Array<[string | null, string | null]>): number | null {
  const vals: number[] = [];
  for (const [a, b] of pairs) {
    if (!a || !b) continue;
    const diff = (new Date(b).getTime() - new Date(a).getTime()) / 60000;
    if (diff >= 0 && diff < 24 * 60) vals.push(diff);
  }
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export default function DriverPerformance() {
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [range, setRange] = useState<RangeKey>("30");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DriverStats[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const since = new Date();
        since.setDate(since.getDate() - Number(range));
        const sinceIso = since.toISOString();

        let ordersQuery = supabase
          .from("orders")
          .select(
            "driver_id, status, accepted_at, picked_up_at, delivered_at, cancelled_at, created_at"
          )
          .not("driver_id", "is", null)
          .gte("created_at", sinceIso);
        let earningsQuery = supabase
          .from("driver_earnings")
          .select("driver_id, driver_payout, created_at")
          .gte("created_at", sinceIso);

        if (!isAdmin) {
          ordersQuery = ordersQuery.eq("driver_id", user.id);
          earningsQuery = earningsQuery.eq("driver_id", user.id);
        }

        const [ordersRes, earningsRes] = await Promise.all([ordersQuery, earningsQuery]);
        if (ordersRes.error) throw ordersRes.error;
        if (earningsRes.error) throw earningsRes.error;

        const orders = ordersRes.data || [];
        const earnings = earningsRes.data || [];

        const driverIds = Array.from(
          new Set([
            ...orders.map((o) => o.driver_id as string),
            ...earnings.map((e) => e.driver_id as string),
          ])
        );

        const nameMap = new Map<string, string>();
        if (driverIds.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", driverIds);
          (profs || []).forEach((p) => nameMap.set(p.user_id, p.full_name || "Driver"));
        }

        const byDriver = new Map<string, DriverStats>();
        const pickupPairs = new Map<string, Array<[string | null, string | null]>>();
        const deliveryPairs = new Map<string, Array<[string | null, string | null]>>();

        const ensure = (id: string) => {
          if (!byDriver.has(id)) {
            byDriver.set(id, {
              driverId: id,
              driverName: nameMap.get(id) || "Driver",
              accepted: 0,
              completed: 0,
              cancelled: 0,
              totalEarnings: 0,
              avgEarnings: 0,
              completionRate: 0,
              avgPickupMin: null,
              avgDeliveryMin: null,
            });
            pickupPairs.set(id, []);
            deliveryPairs.set(id, []);
          }
          return byDriver.get(id)!;
        };

        for (const o of orders) {
          const s = ensure(o.driver_id as string);
          if (o.accepted_at) {
            s.accepted += 1;
            pickupPairs.get(o.driver_id as string)!.push([o.accepted_at, o.picked_up_at]);
          }
          if (o.delivered_at || o.status === "delivered") {
            s.completed += 1;
            deliveryPairs.get(o.driver_id as string)!.push([o.picked_up_at, o.delivered_at]);
          }
          if (
            o.cancelled_at ||
            o.status === "cancelled" ||
            o.status === "rejected" ||
            o.status === "no_driver_found"
          ) {
            s.cancelled += 1;
          }
        }

        for (const e of earnings) {
          const s = ensure(e.driver_id as string);
          s.totalEarnings += Number(e.driver_payout) || 0;
        }

        for (const s of byDriver.values()) {
          s.avgEarnings = s.completed > 0 ? s.totalEarnings / s.completed : 0;
          s.completionRate =
            s.accepted > 0 ? (s.completed / s.accepted) * 100 : s.completed > 0 ? 100 : 0;
          s.avgPickupMin = avgMinutes(pickupPairs.get(s.driverId) || []);
          s.avgDeliveryMin = avgMinutes(deliveryPairs.get(s.driverId) || []);
        }

        const list = Array.from(byDriver.values()).sort(
          (a, b) => b.completed - a.completed || b.totalEarnings - a.totalEarnings
        );
        if (!cancelled) setStats(list);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load driver performance");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isAdmin, range]);

  const totals = useMemo(() => {
    const t = {
      accepted: 0,
      completed: 0,
      cancelled: 0,
      earnings: 0,
    };
    stats.forEach((s) => {
      t.accepted += s.accepted;
      t.completed += s.completed;
      t.cancelled += s.cancelled;
      t.earnings += s.totalEarnings;
    });
    return t;
  }, [stats]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(isAdmin ? "/admin" : "/driver")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Driver Performance</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "Compare all drivers over the selected period."
                : "Your delivery stats over the selected period."}
            </p>
          </div>
        </div>

        <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <TabsList>
            <TabsTrigger value="7">Last 7 days</TabsTrigger>
            <TabsTrigger value="30">Last 30 days</TabsTrigger>
            <TabsTrigger value="90">Last 90 days</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : stats.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No delivery activity in this period.
            </CardContent>
          </Card>
        ) : !isAdmin ? (
          (() => {
            const s = stats[0];
            return (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard label="Accepted Deliveries" value={String(s.accepted)} />
                <StatCard label="Completed Deliveries" value={String(s.completed)} />
                <StatCard label="Cancelled / Failed" value={String(s.cancelled)} />
                <StatCard label="Total Earnings" value={fmtMoney(s.totalEarnings)} />
                <StatCard label="Avg Earnings / Delivery" value={fmtMoney(s.avgEarnings)} />
                <StatCard label="Completion Rate" value={`${s.completionRate.toFixed(0)}%`} />
                <StatCard label="Avg Pickup Time" value={fmtMin(s.avgPickupMin)} />
                <StatCard label="Avg Delivery Time" value={fmtMin(s.avgDeliveryMin)} />
              </div>
            );
          })()
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label="Accepted" value={String(totals.accepted)} />
              <StatCard label="Completed" value={String(totals.completed)} />
              <StatCard label="Cancelled / Failed" value={String(totals.cancelled)} />
              <StatCard label="Total Payouts" value={fmtMoney(totals.earnings)} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Drivers</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead className="text-right">Accepted</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Cancelled</TableHead>
                      <TableHead className="text-right">Earnings</TableHead>
                      <TableHead className="text-right">Avg / Delivery</TableHead>
                      <TableHead className="text-right">Completion</TableHead>
                      <TableHead className="text-right">Avg Pickup</TableHead>
                      <TableHead className="text-right">Avg Delivery</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((s) => (
                      <TableRow key={s.driverId}>
                        <TableCell className="font-medium">{s.driverName}</TableCell>
                        <TableCell className="text-right">{s.accepted}</TableCell>
                        <TableCell className="text-right">{s.completed}</TableCell>
                        <TableCell className="text-right">{s.cancelled}</TableCell>
                        <TableCell className="text-right">{fmtMoney(s.totalEarnings)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(s.avgEarnings)}</TableCell>
                        <TableCell className="text-right">
                          {s.completionRate.toFixed(0)}%
                        </TableCell>
                        <TableCell className="text-right">{fmtMin(s.avgPickupMin)}</TableCell>
                        <TableCell className="text-right">{fmtMin(s.avgDeliveryMin)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
