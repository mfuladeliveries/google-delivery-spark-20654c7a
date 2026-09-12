import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, AlertTriangle, ShieldAlert, Wrench, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  detectOrderIncidents,
  detectDuplicateIncidents,
  detectWhatsAppIncidents,
  sortIncidents,
  countBySeverity,
  groupByKind,
  KIND_LABELS,
  type Incident,
  type IncidentOrder,
  type DuplicateGroup,
  type WhatsAppRow,
} from "@/lib/incidents";

const severityTone: Record<Incident["severity"], string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  medium: "bg-muted text-muted-foreground border-border",
};

const AdminIncidents = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<IncidentOrder[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [drivers, setDrivers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();

    const [ordersRes, waRes, creditRes, earningsRes] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id,order_number,status,payment_status,payment_method,created_at,accepted_at,picked_up_at,delivered_at,cancelled_at,driver_id,restaurant,customer_name,customer_contact,total,subtotal,tax,delivery_fee,tip,discount_amount,refund_status,refund_method,refund_amount,credits_applied",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("whatsapp_notification_outbox")
        .select("id,order_id,recipient,status,attempts,last_error,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("credit_transactions").select("order_id,kind").not("order_id", "is", null).limit(2000),
      supabase.from("driver_earnings").select("order_id").limit(2000),
    ]);

    const orderRows = (ordersRes.data ?? []) as IncidentOrder[];
    setOrders(orderRows);
    const numberById = new Map(orderRows.map((o) => [o.id, o.order_number]));

    const tally = (ids: (string | null)[]) => {
      const counts = new Map<string, number>();
      for (const id of ids) {
        if (!id) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      return [...counts.entries()]
        .filter(([, c]) => c > 1)
        .map<DuplicateGroup>(([orderId, count]) => ({
          orderId,
          orderNumber: numberById.get(orderId) ?? null,
          count,
        }));
    };

    const creditIds = (creditRes.data ?? [])
      .filter((r: { kind: string }) => r.kind !== "spend")
      .map((r: { order_id: string | null }) => r.order_id);

    const all = sortIncidents([
      ...detectOrderIncidents(orderRows),
      ...detectDuplicateIncidents(
        tally(creditIds),
        tally((earningsRes.data ?? []).map((r: { order_id: string | null }) => r.order_id)),
      ),
      ...detectWhatsAppIncidents((waRes.data ?? []) as WhatsAppRow[]),
    ]);
    setIncidents(all);

    const driverIds = [...new Set(orderRows.map((o) => o.driver_id).filter(Boolean))] as string[];
    if (driverIds.length) {
      const { data } = await supabase.from("profiles").select("user_id,full_name").in("user_id", driverIds);
      setDrivers(Object.fromEntries((data ?? []).map((p) => [p.user_id, p.full_name])));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const counts = useMemo(() => countBySeverity(incidents), [incidents]);
  const grouped = useMemo(() => groupByKind(incidents), [incidents]);

  const runAction = async (inc: Incident) => {
    if (!inc.orderId || !inc.action || inc.action === "review") return;
    setBusyKey(inc.key);
    try {
      if (inc.action === "dispatch") {
        const { error } = await supabase.rpc("dispatch_assign_next", { p_order_id: inc.orderId });
        if (error) throw error;
        toast.success("Looking for the next available driver");
      } else if (inc.action === "cancel") {
        const { error } = await supabase.rpc("admin_cancel_order", {
          p_order_id: inc.orderId,
          p_reason: "Cancelled from Incident & Recovery — payment not completed",
        });
        if (error) throw error;
        toast.success("Order cancelled");
      } else if (inc.action === "regenerate_pin") {
        const { data, error } = await supabase.rpc("regenerate_delivery_pin", { p_order_id: inc.orderId });
        if (error) throw error;
        toast.success(`New delivery PIN sent: ${data ?? "done"}`);
      } else if (inc.action === "mark_refund_paid") {
        const { error } = await supabase.rpc("admin_mark_bank_refund_paid", { p_order_id: inc.orderId });
        if (error) throw error;
        toast.success("Refund marked as paid");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete that action");
    } finally {
      setBusyKey(null);
    }
  };

  const actionLabel: Record<string, string> = {
    dispatch: "Find a driver",
    cancel: "Cancel order",
    regenerate_pin: "Send new PIN",
    mark_refund_paid: "Mark refund paid",
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-sm font-bold">Incident &amp; Recovery</h1>
            <p className="text-[10px] text-muted-foreground">Live problems needing attention</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["Critical", counts.critical, "text-destructive"],
              ["High", counts.high, "text-amber-500"],
              ["Watch", counts.medium, "text-muted-foreground"],
            ] as const
          ).map(([label, value, tone]) => (
            <Card key={label} className="p-3">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold ${tone}`}>{value}</p>
            </Card>
          ))}
        </div>

        {!loading && incidents.length === 0 && (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <ShieldAlert className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-bold">No problems found</p>
            <p className="text-xs text-muted-foreground">
              Every recent order is paying, moving and being delivered normally.
            </p>
          </Card>
        )}

        {[...grouped.entries()].map(([kind, list]) => (
          <Card key={kind} className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wide">{KIND_LABELS[kind]}</h2>
              <Badge variant="outline" className="ml-auto text-[10px]">
                {list.length}
              </Badge>
            </div>
            <div className="divide-y divide-border">
              {list.map((inc) => {
                const o = inc.orderId ? orderById.get(inc.orderId) : undefined;
                return (
                  <div key={inc.key} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${severityTone[inc.severity]}`}>
                        {inc.severity}
                      </Badge>
                      <p className="text-sm font-bold">{inc.title}</p>
                      <span className="ml-auto text-[10px] text-muted-foreground">{inc.ageMinutes} min</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{inc.detail}</p>
                    {o && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-4">
                        <span>Status: {o.status}</span>
                        <span>Payment: {o.payment_status ?? "—"}</span>
                        <span>Restaurant: {o.restaurant ?? "—"}</span>
                        <span>Driver: {o.driver_id ? drivers[o.driver_id] ?? "assigned" : "none"}</span>
                        <span className="col-span-2">Customer: {o.customer_name ?? "—"}</span>
                        <span className="col-span-2">{o.customer_contact ?? ""}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {inc.action && inc.action !== "review" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyKey === inc.key}
                          onClick={() => runAction(inc)}
                        >
                          <Wrench className="mr-1.5 h-3.5 w-3.5" />
                          {actionLabel[inc.action]}
                        </Button>
                      )}
                      {inc.orderNumber != null && (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/admin/support?q=${inc.orderNumber}`}>
                            <Search className="mr-1.5 h-3.5 w-3.5" />
                            Open in support
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminIncidents;
