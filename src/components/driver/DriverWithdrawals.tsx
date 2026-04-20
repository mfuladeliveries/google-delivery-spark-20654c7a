import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Wallet, Clock, CheckCircle2, XCircle, Banknote, AlertCircle } from "lucide-react";
import { z } from "zod";

const MIN_WITHDRAWAL = 100;

interface BankDetails {
  bank_account_holder: string;
  bank_name: string;
  bank_account_number: string;
  bank_branch_code: string;
  bank_account_type: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: "pending" | "approved" | "paid" | "rejected";
  rejection_reason: string | null;
  admin_notes: string | null;
  requested_at: string;
  approved_at: string | null;
  paid_at: string | null;
  rejected_at: string | null;
  bank_name: string;
  bank_account_number: string;
}

const bankSchema = z.object({
  bank_account_holder: z.string().trim().min(2, "Holder name is required").max(120),
  bank_name: z.string().trim().min(2, "Bank name is required").max(80),
  bank_account_number: z.string().trim().regex(/^\d{6,20}$/, "Account must be 6–20 digits"),
  bank_branch_code: z.string().trim().regex(/^\d{3,10}$/, "Branch code must be 3–10 digits"),
  bank_account_type: z.enum(["cheque", "savings", "transmission", "business"]),
});

const STATUS_META: Record<WithdrawalRequest["status"], { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending review", className: "bg-amber-100 text-amber-700", icon: Clock },
  approved: { label: "Approved — awaiting payout", className: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  paid: { label: "Paid", className: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-600", icon: XCircle },
};

const DriverWithdrawals = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [bank, setBank] = useState<BankDetails>({
    bank_account_holder: "",
    bank_name: "",
    bank_account_number: "",
    bank_branch_code: "",
    bank_account_type: "cheque",
  });
  const [loadingBank, setLoadingBank] = useState(true);
  const [savingBank, setSavingBank] = useState(false);
  const [amount, setAmount] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [showBankForm, setShowBankForm] = useState(false);

  const hasBankDetails =
    !!bank.bank_account_holder && !!bank.bank_name && !!bank.bank_account_number && !!bank.bank_branch_code;

  const pendingRequest = requests.find((r) => r.status === "pending" || r.status === "approved");

  useEffect(() => {
    if (!user) return;
    let active = true;

    const load = async () => {
      const [{ data: profileData }, { data: balanceData }, { data: reqData }] = await Promise.all([
        supabase
          .from("driver_profiles")
          .select("bank_account_holder, bank_name, bank_account_number, bank_branch_code, bank_account_type")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.rpc("get_driver_balance", { p_driver_id: user.id }),
        supabase
          .from("withdrawal_requests")
          .select("id, amount, status, rejection_reason, admin_notes, requested_at, approved_at, paid_at, rejected_at, bank_name, bank_account_number")
          .eq("driver_id", user.id)
          .order("requested_at", { ascending: false }),
      ]);
      if (!active) return;
      if (profileData) {
        setBank({
          bank_account_holder: profileData.bank_account_holder || "",
          bank_name: profileData.bank_name || "",
          bank_account_number: profileData.bank_account_number || "",
          bank_branch_code: profileData.bank_branch_code || "",
          bank_account_type: profileData.bank_account_type || "cheque",
        });
      }
      if (typeof balanceData === "number") setBalance(Number(balanceData));
      if (reqData) setRequests(reqData as WithdrawalRequest[]);
      setLoadingBank(false);
    };

    load();

    const channel = supabase
      .channel("driver-withdrawals-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawal_requests", filter: `driver_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleSaveBank = async () => {
    const parsed = bankSchema.safeParse(bank);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Invalid bank details");
      return;
    }
    setSavingBank(true);
    const { error } = await supabase
      .from("driver_profiles")
      .update(parsed.data)
      .eq("user_id", user!.id);
    setSavingBank(false);
    if (error) {
      toast.error("Failed to save bank details");
      return;
    }
    toast.success("Bank details saved");
    setShowBankForm(false);
  };

  const handleRequest = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < MIN_WITHDRAWAL) {
      toast.error(`Minimum withdrawal is R${MIN_WITHDRAWAL}`);
      return;
    }
    if (amt > balance) {
      toast.error(`Insufficient balance (available: R${balance.toFixed(2)})`);
      return;
    }
    setRequesting(true);
    const { data, error } = await supabase.rpc("request_withdrawal", { p_amount: amt });
    setRequesting(false);
    if (error) {
      toast.error(error.message || "Withdrawal failed");
      return;
    }
    setAmount("");
    toast.success("Withdrawal requested! Admin will review shortly.");
    // Fire-and-forget push notification to admins
    supabase.functions
      .invoke("withdrawal-notify", {
        body: { event: "requested", request_id: data, amount: amt },
      })
      .catch(() => {});
  };

  if (loadingBank) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Balance card */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-[hsl(var(--driver-success)/0.15)] to-[hsl(var(--driver-success)/0.05)] p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Withdrawable Balance</p>
            <p className="mt-1 text-4xl font-bold text-foreground">R{balance.toFixed(2)}</p>
            <p className="mt-1 text-xs text-muted-foreground">After pending & paid withdrawals</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--driver-success))] text-white shadow-md">
            <Wallet className="h-7 w-7" />
          </div>
        </div>
      </div>

      {/* Bank details */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-bold text-foreground">
            <Banknote className="h-4 w-4 text-primary" /> Bank Details
          </h3>
          {hasBankDetails && !showBankForm && (
            <button
              onClick={() => setShowBankForm(true)}
              className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary"
            >
              Edit
            </button>
          )}
        </div>

        {hasBankDetails && !showBankForm ? (
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-foreground">{bank.bank_account_holder}</p>
            <p className="text-muted-foreground">
              {bank.bank_name} · {bank.bank_account_type}
            </p>
            <p className="text-muted-foreground">
              •••• {bank.bank_account_number.slice(-4)} · Branch {bank.bank_branch_code}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {!hasBankDetails && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Add your bank details to request withdrawals.</span>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Account Holder</label>
              <input
                value={bank.bank_account_holder}
                onChange={(e) => setBank((b) => ({ ...b, bank_account_holder: e.target.value }))}
                placeholder="Full name as on account"
                maxLength={120}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Bank</label>
                <input
                  value={bank.bank_name}
                  onChange={(e) => setBank((b) => ({ ...b, bank_name: e.target.value }))}
                  placeholder="e.g. FNB, Capitec"
                  maxLength={80}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Type</label>
                <select
                  value={bank.bank_account_type}
                  onChange={(e) => setBank((b) => ({ ...b, bank_account_type: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="cheque">Cheque</option>
                  <option value="savings">Savings</option>
                  <option value="transmission">Transmission</option>
                  <option value="business">Business</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Account Number</label>
                <input
                  value={bank.bank_account_number}
                  onChange={(e) => setBank((b) => ({ ...b, bank_account_number: e.target.value.replace(/\D/g, "") }))}
                  inputMode="numeric"
                  placeholder="Digits only"
                  maxLength={20}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Branch Code</label>
                <input
                  value={bank.bank_branch_code}
                  onChange={(e) => setBank((b) => ({ ...b, bank_branch_code: e.target.value.replace(/\D/g, "") }))}
                  inputMode="numeric"
                  placeholder="e.g. 250655"
                  maxLength={10}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              {hasBankDetails && (
                <button
                  onClick={() => setShowBankForm(false)}
                  className="flex-1 rounded-xl border border-border bg-card py-2.5 text-xs font-bold text-muted-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSaveBank}
                disabled={savingBank}
                className="flex-[2] rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {savingBank ? "Saving..." : "Save Bank Details"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Request withdrawal */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <h3 className="mb-3 flex items-center gap-2 font-bold text-foreground">
          <Wallet className="h-4 w-4 text-primary" /> Request Withdrawal
        </h3>

        {pendingRequest ? (
          <div className="rounded-xl bg-secondary p-3 text-sm">
            <p className="font-semibold text-foreground">
              R{Number(pendingRequest.amount).toFixed(2)} · {STATUS_META[pendingRequest.status].label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              You can only submit another request once this one is paid or rejected.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Amount (min R{MIN_WITHDRAWAL})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">R</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  placeholder="0.00"
                  disabled={!hasBankDetails || balance < MIN_WITHDRAWAL}
                  className="w-full rounded-xl border border-border bg-background py-3 pl-7 pr-3 text-base font-semibold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
              </div>
            </div>
            <button
              onClick={handleRequest}
              disabled={requesting || !hasBankDetails || balance < MIN_WITHDRAWAL}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {!hasBankDetails
                ? "Add bank details first"
                : balance < MIN_WITHDRAWAL
                  ? `Earn R${MIN_WITHDRAWAL} to unlock`
                  : requesting
                    ? "Submitting..."
                    : "Request Withdrawal"}
            </button>
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <h3 className="mb-3 font-bold text-foreground">Withdrawal History</h3>
        {requests.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-8 text-center text-sm text-muted-foreground">
            No withdrawals yet
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => {
              const meta = STATUS_META[r.status];
              const Icon = meta.icon;
              return (
                <div key={r.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-foreground">R{Number(r.amount).toFixed(2)}</span>
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.className}`}>
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(r.requested_at).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {r.bank_name} ••••{r.bank_account_number.slice(-4)}
                  </p>
                  {r.status === "rejected" && r.rejection_reason && (
                    <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-[11px] text-red-700">
                      Reason: {r.rejection_reason}
                    </p>
                  )}
                  {r.status === "paid" && r.paid_at && (
                    <p className="mt-1 text-[10px] text-green-600">
                      Paid {new Date(r.paid_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverWithdrawals;
