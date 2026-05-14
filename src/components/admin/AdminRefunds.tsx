import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface RefundRow {
  id: string;
  order_number: number;
  user_id: string;
  customer_name: string;
  customer_contact: string;
  total: number;
  refund_amount: number;
  refund_method: "credits" | "bank" | null;
  refund_status: "pending" | "credited" | "bank_pending" | "bank_paid" | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  refunded_at: string | null;
  restaurant: string;
  payment_method: string;
}

const TABS = ["bank_pending", "pending", "bank_paid", "credited"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  bank_pending: "Bank payout due",
  pending: "Awaiting choice",
  bank_paid: "Bank paid",
  credited: "Credited to wallet",
};

const AdminRefunds = () => {
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("bank_pending");
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, order_number, user_id, customer_name, customer_contact, total, refund_amount, refund_method, refund_status, cancelled_at, cancel_reason, refunded_at, restaurant, payment_method",
        )
        .not("refund_status", "is", null)
        .order("cancelled_at", { ascending: false });
      if (active && data) setRows(data as RefundRow[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("admin-refunds-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => load())
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { bank_pending: 0, pending: 0, bank_paid: 0, credited: 0 };
    rows.forEach((r) => {
      if (r.refund_status && r.refund_status in c) c[r.refund_status as Tab]++;
    });
    return c;
  }, [rows]);

  const filtered = rows.filter((r) => r.refund_status === tab);

  const markPaid = async (r: RefundRow) => {
    if (
      !window.confirm(
        `Mark R${Number(r.refund_amount).toFixed(2)} bank refund for order #${r.order_number} as paid?`,
      )
    )
      return;
    setActingId(r.id);
    const { error } = await supabase.rpc("admin_mark_bank_refund_paid", { p_order_id: r.id });
    setActingId(null);
    if (error) {
      toast.error(error.message || "Failed to mark as paid");
      return;
    }
    toast.success(`Refund for #${r.order_number} marked as paid`);
    // Notify customer
    supabase.functions
      .invoke("push-notify", {
        body: {
          order_id: r.id,
          order_number: r.order_number,
          status: "bank_refund_paid",
          user_id: r.user_id,
          refund_amount: r.refund_amount,
        },
      })
      .catch(() => {});
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const totalBankDue = rows
    .filter((r) => r.refund_status === "bank_pending")
    .reduce((s, r) => s + Number(r.refund_amount || 0), 0);
  const totalCredited = rows
    .filter((r) => r.refund_status === "credited")
    .reduce((s, r) => s + Number(r.refund_amount || 0), 0);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-foreground">💸 Customer Refunds</h2>
      </div>

      {/* Summary tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-foreground">R{totalBankDue.toFixed(0)}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Bank payouts due</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Banknote className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-foreground">R{totalCredited.toFixed(0)}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Credited to wallets</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-foreground">{counts.pending}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Awaiting customer choice</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            {TAB_LABELS[t]} ({counts[t] || 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          No refunds in this state
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground">
                      R{Number(r.refund_amount).toFixed(2)}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">
                      #{r.order_number}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-foreground">{r.customer_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.customer_contact} · 🍽️ {r.restaurant}
                  </p>
                  {r.cancelled_at && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Cancelled{" "}
                      {new Date(r.cancelled_at).toLocaleString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
                {r.refund_status === "credited" && (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                    <CheckCircle2 className="h-3 w-3" /> Credited
                  </span>
                )}
                {r.refund_status === "bank_paid" && (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                    <CheckCircle2 className="h-3 w-3" /> Paid
                  </span>
                )}
              </div>

              {r.cancel_reason && (
                <p className="mt-2 rounded-lg bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
                  Reason: {r.cancel_reason}
                </p>
              )}

              {r.refund_status === "bank_pending" && (
                <button
                  onClick={() => markPaid(r)}
                  disabled={actingId === r.id}
                  className="btn-glow mt-3 w-full rounded-xl gradient-maroon py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {actingId === r.id ? "Processing…" : "Mark as Paid"}
                </button>
              )}

              {r.refund_status === "pending" && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Waiting for customer to choose wallet credit or bank refund.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default AdminRefunds;
