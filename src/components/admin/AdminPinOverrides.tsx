import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, Check, X, RefreshCw } from "lucide-react";

interface OverrideRow {
  id: string;
  order_id: string;
  driver_name: string;
  customer_name: string;
  reason: string;
  status: string;
  approved_by_email: string | null;
  requested_at: string;
  decided_at: string | null;
  used_at: string | null;
}

/**
 * Admin panel for the "customer never got their delivery PIN" flow.
 * Shows driver help requests, lets an admin approve/reject them, and keeps
 * the approval trail (who approved, when, and why) visible for auditing.
 */
const AdminPinOverrides = () => {
  const [rows, setRows] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [orderNumbers, setOrderNumbers] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("delivery_pin_overrides" as any)
      .select("*")
      .order("requested_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("pin overrides load failed", error);
    } else {
      const list = (data ?? []) as unknown as OverrideRow[];
      setRows(list);
      const ids = list.map((r) => r.order_id);
      if (ids.length) {
        const { data: ords } = await supabase
          .from("orders")
          .select("id, order_number")
          .in("id", ids);
        setOrderNumbers(
          Object.fromEntries((ords ?? []).map((o: any) => [o.id, o.order_number])),
        );
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("pin_overrides_admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_pin_overrides" },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_decide_pin_override" as any, {
      p_request_id: id,
      p_approve: approve,
      p_notes: approve ? "Customer and order details confirmed by admin" : null,
    });
    if (error) {
      console.error("pin override decision failed", error);
      toast.error(error.message || "Could not save that decision");
    } else {
      toast.success(approve ? "Delivery approved — driver can complete it" : "Request rejected");
      load();
    }
    setBusy(null);
  };

  const resendPin = async (orderId: string) => {
    setBusy(orderId);
    const { data, error } = await supabase.rpc("regenerate_delivery_pin" as any, {
      p_order_id: orderId,
    });
    if (error) {
      console.error("regenerate pin failed", error);
      toast.error(error.message || "Could not create a new PIN");
    } else {
      toast.success(`New PIN for the customer: ${data}`, { duration: 12000 });
    }
    setBusy(null);
  };

  const pending = rows.filter((r) => r.status === "requested");
  const history = rows.filter((r) => r.status !== "requested");

  if (loading) {
    return (
      <div className="mb-4 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
        Loading PIN help requests…
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="mb-4 space-y-3">
      {pending.length > 0 && (
        <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold text-destructive">
            <ShieldAlert className="h-4 w-4" /> Delivery PIN help needed ({pending.length})
          </p>
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-3">
                <p className="text-sm font-bold text-foreground">
                  Order #{orderNumbers[r.order_id] ?? "—"} · {r.customer_name || "Customer"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Driver: {r.driver_name || "—"} · {r.reason}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Asked {new Date(r.requested_at).toLocaleString()}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => resendPin(r.order_id)}
                    disabled={busy !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-bold text-foreground disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Send new PIN
                  </button>
                  <button
                    onClick={() => decide(r.id, true)}
                    disabled={busy !== null}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve delivery
                  </button>
                  <button
                    onClick={() => decide(r.id, false)}
                    disabled={busy !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-xs font-bold text-destructive disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <details className="rounded-2xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-bold text-foreground">
            PIN override history ({history.length})
          </summary>
          <div className="mt-3 space-y-2">
            {history.map((r) => (
              <div key={r.id} className="rounded-lg bg-secondary/40 px-3 py-2 text-xs">
                <span className="font-bold text-foreground">
                  Order #{orderNumbers[r.order_id] ?? "—"}
                </span>{" "}
                · {r.customer_name || "Customer"} · driver {r.driver_name || "—"} ·{" "}
                <span className="font-semibold capitalize">{r.status}</span>
                <div className="text-[10px] text-muted-foreground">
                  {r.reason} · {r.approved_by_email ? `by ${r.approved_by_email} · ` : ""}
                  {new Date(r.decided_at || r.requested_at).toLocaleString()}
                  {r.used_at ? ` · completed ${new Date(r.used_at).toLocaleString()}` : ""}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default AdminPinOverrides;
