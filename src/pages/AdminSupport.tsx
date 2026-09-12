import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Search as SearchIcon,
  RefreshCw,
  Wrench,
  Flag,
  KeyRound,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { buildOrderTimeline } from "@/lib/dailyReport";
import { detectOrderIncidents, type IncidentOrder } from "@/lib/incidents";

const FOLLOWUP_KEY = "support_followups";

type SupportOrder = IncidentOrder & {
  payment_initiated_at?: string | null;
  paid_at?: string | null;
  payment_failed_at?: string | null;
  picking_up_at?: string | null;
  arrived_at?: string | null;
  refunded_at?: string | null;
  delivery_code_hash?: string | null;
  admin_delivery_code?: string | null;
  pin_attempts?: number | null;
  customer_address?: string | null;
  payment_failure_reason?: string | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const AdminSupport = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [results, setResults] = useState<SupportOrder[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [followups, setFollowups] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const loadFollowups = useCallback(async () => {
    const { data } = await supabase.from("app_settings").select("value").eq("key", FOLLOWUP_KEY).maybeSingle();
    const value = (data?.value ?? {}) as Record<string, string>;
    setFollowups(value && typeof value === "object" ? value : {});
  }, []);

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      setLoading(true);

      const columns =
        "id,order_number,status,payment_status,payment_method,payment_failure_reason,created_at,payment_initiated_at,paid_at,payment_failed_at,accepted_at,picking_up_at,arrived_at,picked_up_at,delivered_at,cancelled_at,refunded_at,driver_id,restaurant,customer_name,customer_contact,customer_address,total,subtotal,tax,delivery_fee,tip,discount_amount,refund_status,refund_method,refund_amount,credits_applied,delivery_code_hash,admin_delivery_code,pin_attempts";

      let builder = supabase.from("orders").select(columns).order("created_at", { ascending: false }).limit(50);

      if (q) {
        const asNumber = Number(q.replace(/[^0-9]/g, ""));
        const filters = [`customer_name.ilike.%${q}%`, `customer_contact.ilike.%${q}%`, `restaurant.ilike.%${q}%`];
        if (!Number.isNaN(asNumber) && q.replace(/[^0-9]/g, "").length > 0) {
          filters.push(`order_number.eq.${asNumber}`);
        }

        // Driver name search: resolve matching driver profiles first.
        const { data: matchedDrivers } = await supabase
          .from("profiles")
          .select("user_id")
          .ilike("full_name", `%${q}%`)
          .limit(20);
        const driverIds = (matchedDrivers ?? []).map((d) => d.user_id);
        if (driverIds.length) filters.push(`driver_id.in.(${driverIds.join(",")})`);

        builder = builder.or(filters.join(","));
      }

      const { data, error } = await builder;
      if (error) {
        toast.error("Search failed");
        setResults([]);
      } else {
        const rows = (data ?? []) as SupportOrder[];
        setResults(rows);
        const ids = [...new Set(rows.map((r) => r.driver_id).filter(Boolean))] as string[];
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles").select("user_id,full_name").in("user_id", ids);
          setDriverNames(Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.full_name])));
        }
        if (rows.length === 1) setOpenId(rows[0].id);
      }
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    loadFollowups();
    runSearch(params.get("q") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const incidentsByOrder = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const inc of detectOrderIncidents(results)) {
      if (!inc.orderId) continue;
      map.set(inc.orderId, [...(map.get(inc.orderId) ?? []), inc.title]);
    }
    return map;
  }, [results]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams(query ? { q: query } : {});
    runSearch(query);
  };

  const action = async (order: SupportOrder, kind: "dispatch" | "pin" | "cancel" | "refund_paid") => {
    setBusy(`${order.id}:${kind}`);
    try {
      if (kind === "dispatch") {
        const { error } = await supabase.rpc("dispatch_assign_next", { p_order_id: order.id });
        if (error) throw error;
        toast.success("Looking for the next driver");
      } else if (kind === "pin") {
        const { data, error } = await supabase.rpc("regenerate_delivery_pin", { p_order_id: order.id });
        if (error) throw error;
        toast.success(`New PIN issued: ${data ?? "done"}`);
      } else if (kind === "cancel") {
        const { error } = await supabase.rpc("admin_cancel_order", {
          p_order_id: order.id,
          p_reason: "Cancelled by support",
        });
        if (error) throw error;
        toast.success("Order cancelled");
      } else {
        const { error } = await supabase.rpc("admin_mark_bank_refund_paid", { p_order_id: order.id });
        if (error) throw error;
        toast.success("Refund marked as paid");
      }
      await runSearch(query);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const toggleFollowup = async (order: SupportOrder) => {
    const next = { ...followups };
    if (next[order.id]) delete next[order.id];
    else next[order.id] = new Date().toISOString();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: FOLLOWUP_KEY, value: next }, { onConflict: "key" });
    if (error) {
      toast.error("Could not save the follow-up flag");
      return;
    }
    setFollowups(next);
    toast.success(next[order.id] ? "Marked for follow-up" : "Follow-up cleared");
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-sm font-bold">Customer Support</h1>
            <p className="text-[10px] text-muted-foreground">Find an order and fix it</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => runSearch(query)}
            disabled={loading}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-4 px-4 py-5">
        <form onSubmit={submit} className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Order number, customer, phone, restaurant or driver"
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={loading}>
            Search
          </Button>
        </form>

        {!results.length && !loading && (
          <Card className="p-8 text-center text-sm text-muted-foreground">No orders matched that search.</Card>
        )}

        {results.map((o) => {
          const open = openId === o.id;
          const problems = incidentsByOrder.get(o.id) ?? [];
          const timeline = buildOrderTimeline(o);
          return (
            <Card key={o.id} className="overflow-hidden">
              <button
                onClick={() => setOpenId(open ? null : o.id)}
                className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left hover:bg-secondary/40"
              >
                <span className="text-sm font-bold">#{o.order_number ?? "—"}</span>
                <Badge variant="outline" className="text-[10px]">
                  {o.status}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {o.payment_status ?? "—"}
                </Badge>
                {followups[o.id] && (
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/15 text-[10px] text-amber-500">
                    follow-up
                  </Badge>
                )}
                {problems.length > 0 && (
                  <Badge
                    variant="outline"
                    className="border-destructive/30 bg-destructive/15 text-[10px] text-destructive"
                  >
                    {problems.length} issue{problems.length > 1 ? "s" : ""}
                  </Badge>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">{fmt(o.created_at)}</span>
              </button>

              {open && (
                <div className="space-y-4 border-t border-border px-4 py-4">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] sm:grid-cols-3">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="col-span-1 sm:col-span-2 font-medium">
                      {o.customer_name} · {o.customer_contact}
                    </span>
                    <span className="text-muted-foreground">Address</span>
                    <span className="col-span-1 sm:col-span-2">{o.customer_address ?? "—"}</span>
                    <span className="text-muted-foreground">Restaurant</span>
                    <span className="col-span-1 sm:col-span-2">{o.restaurant ?? "—"}</span>
                    <span className="text-muted-foreground">Driver</span>
                    <span className="col-span-1 sm:col-span-2">
                      {o.driver_id ? driverNames[o.driver_id] ?? "assigned" : "not assigned"}
                    </span>
                    <span className="text-muted-foreground">Total</span>
                    <span className="col-span-1 sm:col-span-2">R {(o.total ?? 0).toFixed(2)}</span>
                    <span className="text-muted-foreground">Wallet credits used</span>
                    <span className="col-span-1 sm:col-span-2">R {(o.credits_applied ?? 0).toFixed(2)}</span>
                    <span className="text-muted-foreground">Refund</span>
                    <span className="col-span-1 sm:col-span-2">
                      {o.refund_status
                        ? `${o.refund_status}${o.refund_method ? ` (${o.refund_method})` : ""} · R ${(
                            o.refund_amount ?? 0
                          ).toFixed(2)}`
                        : "none"}
                    </span>
                    <span className="text-muted-foreground">Delivery PIN</span>
                    <span className="col-span-1 sm:col-span-2 flex items-center gap-1.5">
                      <KeyRound className="h-3 w-3" />
                      {o.delivery_code_hash ? "issued" : "not issued"} · {o.pin_attempts ?? 0} attempt(s)
                      {o.admin_delivery_code ? " · admin override active" : ""}
                    </span>
                    {o.payment_failure_reason && (
                      <>
                        <span className="text-muted-foreground">Payment error</span>
                        <span className="col-span-1 sm:col-span-2 text-destructive">
                          {o.payment_failure_reason}
                        </span>
                      </>
                    )}
                  </div>

                  {problems.length > 0 && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                      <p className="text-[10px] font-bold uppercase text-destructive">Detected problems</p>
                      <ul className="mt-1 space-y-0.5 text-[11px] text-destructive">
                        {problems.map((p) => (
                          <li key={p}>• {p}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                      <Clock className="h-3 w-3" /> Timeline
                    </p>
                    <ol className="space-y-1.5 border-l border-border pl-3">
                      {timeline.map((t) => (
                        <li key={t.step} className="text-[11px]">
                          <span className="font-medium">{t.step}</span>
                          <span className="ml-2 text-muted-foreground">{fmt(t.at)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!["delivered", "cancelled", "rejected"].includes(o.status) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `${o.id}:dispatch`}
                          onClick={() => action(o, "dispatch")}
                        >
                          <Wrench className="mr-1.5 h-3.5 w-3.5" />
                          Find a driver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `${o.id}:pin`}
                          onClick={() => action(o, "pin")}
                        >
                          <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                          Send new PIN
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `${o.id}:cancel`}
                          onClick={() => action(o, "cancel")}
                        >
                          Cancel order
                        </Button>
                      </>
                    )}
                    {o.refund_status === "pending" && o.refund_method === "bank" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === `${o.id}:refund_paid`}
                        onClick={() => action(o, "refund_paid")}
                      >
                        Mark refund paid
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => toggleFollowup(o)}>
                      <Flag className="mr-1.5 h-3.5 w-3.5" />
                      {followups[o.id] ? "Clear follow-up" : "Mark for follow-up"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminSupport;
