import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, CheckCircle2, XCircle, Clock, DollarSign, Download } from "lucide-react";
import { toast } from "sonner";
import { generateWithdrawalReceipt } from "@/lib/withdrawalReceipt";

interface WithdrawalRow {
  id: string;
  driver_id: string;
  amount: number;
  status: "pending" | "approved" | "paid" | "rejected";
  bank_account_holder: string;
  bank_name: string;
  bank_account_number: string;
  bank_branch_code: string;
  bank_account_type: string;
  rejection_reason: string | null;
  admin_notes: string | null;
  requested_at: string;
  approved_at: string | null;
  paid_at: string | null;
  rejected_at: string | null;
}

const STATUS_TABS = ["pending", "approved", "paid", "rejected"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_STYLE: Record<StatusTab, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

const STATUS_ICON: Record<StatusTab, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle2,
  paid: CheckCircle2,
  rejected: XCircle,
};

interface AdminWithdrawalsProps {
  drivers: { user_id: string; profile?: { full_name: string; contact_number: string } }[];
}

const AdminWithdrawals = ({ drivers }: AdminWithdrawalsProps) => {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusTab>("pending");
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("requested_at", { ascending: false });
      if (active && data) setRows(data as WithdrawalRow[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("admin-withdrawals-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, () => load())
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

  const filtered = rows.filter((r) => r.status === tab);

  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = { pending: 0, approved: 0, paid: 0, rejected: 0 };
    rows.forEach((r) => {
      c[r.status] = (c[r.status] || 0) + 1;
    });
    return c;
  }, [rows]);

  const totalPendingAmount = rows
    .filter((r) => r.status === "pending" || r.status === "approved")
    .reduce((s, r) => s + Number(r.amount), 0);
  const totalPaidAmount = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);

  const updateStatus = async (
    request: WithdrawalRow,
    newStatus: "approved" | "paid" | "rejected",
    rejectionReason?: string
  ) => {
    setActingId(request.id);
    const { error } = await supabase.rpc("admin_update_withdrawal", {
      p_request_id: request.id,
      p_status: newStatus,
      p_rejection_reason: rejectionReason || null,
      p_notes: null,
    });
    setActingId(null);
    if (error) {
      toast.error(error.message || "Update failed");
      return;
    }
    toast.success(`Withdrawal marked as ${newStatus}`);
    // Fire-and-forget notification
    supabase.functions
      .invoke("withdrawal-notify", {
        body: {
          event: newStatus,
          request_id: request.id,
          driver_id: request.driver_id,
          amount: request.amount,
          reason: rejectionReason,
        },
      })
      .catch(() => {});
  };

  const handleApprove = (r: WithdrawalRow) => updateStatus(r, "approved");
  const handleMarkPaid = (r: WithdrawalRow) => updateStatus(r, "paid");
  const handleReject = (r: WithdrawalRow) => {
    const reason = window.prompt("Reason for rejection? (shown to driver)");
    if (!reason || !reason.trim()) return;
    updateStatus(r, "rejected", reason.trim());
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-foreground">🏦 Withdrawals</h2>
      </div>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-foreground">R{totalPendingAmount.toFixed(0)}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Awaiting payout</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-green-50 text-green-600">
            <DollarSign className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-foreground">R{totalPaidAmount.toFixed(0)}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Total paid out</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Banknote className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-foreground">{rows.length}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Total requests</div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto scrollbar-hide">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
              tab === s
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            {s} ({counts[s] || 0})
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          No {tab} withdrawals
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const Icon = STATUS_ICON[r.status];
            const isActing = actingId === r.id;
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-foreground">R{Number(r.amount).toFixed(2)}</span>
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[r.status]}`}>
                        <Icon className="h-3 w-3" />
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {driverNameById.get(r.driver_id) || "Unknown driver"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Requested {new Date(r.requested_at).toLocaleString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {/* Bank details */}
                <div className="mt-3 rounded-xl bg-secondary p-3 text-xs">
                  <p className="font-semibold text-foreground">{r.bank_account_holder}</p>
                  <p className="text-muted-foreground">
                    {r.bank_name} · {r.bank_account_type} · Acct {r.bank_account_number} · Branch {r.bank_branch_code}
                  </p>
                </div>

                {r.status === "rejected" && r.rejection_reason && (
                  <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-[11px] text-red-700">
                    Rejected: {r.rejection_reason}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  {r.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleApprove(r)}
                        disabled={isActing}
                        className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(r)}
                        disabled={isActing}
                        className="flex-1 rounded-xl border border-destructive/30 bg-destructive/5 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {r.status === "approved" && (
                    <>
                      <button
                        onClick={() => handleMarkPaid(r)}
                        disabled={isActing}
                        className="flex-1 rounded-xl bg-green-600 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Mark as Paid
                      </button>
                      <button
                        onClick={() => handleReject(r)}
                        disabled={isActing}
                        className="flex-1 rounded-xl border border-destructive/30 bg-destructive/5 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {r.status === "paid" && (
                    <button
                      onClick={() =>
                        generateWithdrawalReceipt({
                          id: r.id,
                          amount: Number(r.amount),
                          driver_name: driverNameById.get(r.driver_id) || "Driver",
                          bank_account_holder: r.bank_account_holder,
                          bank_name: r.bank_name,
                          bank_account_number: r.bank_account_number,
                          bank_branch_code: r.bank_branch_code,
                          bank_account_type: r.bank_account_type,
                          requested_at: r.requested_at,
                          approved_at: r.approved_at,
                          paid_at: r.paid_at,
                        })
                      }
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-bold text-foreground hover:bg-secondary"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Receipt
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default AdminWithdrawals;
