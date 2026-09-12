import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerCredits } from "@/hooks/useCustomerCredits";
import { storeInfo } from "@/data/menu";
import { Gift, Copy, Check, MessageCircle, Wallet } from "lucide-react";
import { toast } from "sonner";

interface ReferralRow {
  id: string;
  referral_code: string;
  status: string;
  referrer_reward: number;
  referred_discount: number;
  created_at: string;
  rewarded_at: string | null;
}

const statusMeta: Record<string, { label: string; cls: string }> = {
  pending: { label: "Signed up", cls: "bg-amber-100 text-amber-700" },
  rewarded: { label: "Reward paid", cls: "bg-green-100 text-green-700" },
};

const ReferralSection = () => {
  const { user } = useAuth();
  const { balance: walletBalance } = useCustomerCredits();
  const [code, setCode] = useState("");
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: refCode }, { data: refs }] = await Promise.all([
        (supabase as any).rpc("get_or_create_referral_code"),
        (supabase as any)
          .from("referrals")
          .select("id, referral_code, status, referrer_reward, referred_discount, created_at, rewarded_at")
          .eq("referrer_user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      if (refCode) setCode(String(refCode));
      if (refs) setReferrals(refs as ReferralRow[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Referral code copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — long-press the code to copy it");
    }
  };

  const shareWhatsApp = () => {
    const text = `Order food on Mfula Deliveries and get R10 off your first order! Use my referral code ${code} at checkout: ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const totalEarned = referrals
    .filter((r) => r.status === "rewarded")
    .reduce((sum, r) => sum + Number(r.referrer_reward || 0), 0);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="py-6 text-center">
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
      <h2 className="flex items-center gap-2 font-bold text-sm text-foreground">
        <Gift className="h-4 w-4 text-primary" /> Refer & Earn
      </h2>

      <p className="text-xs text-muted-foreground">
        Share your code — a new customer gets{" "}
        <span className="font-bold text-foreground">R10 off</span> their first order, and you
        receive <span className="font-bold text-foreground">R10 wallet credit</span> after their
        first delivery.
      </p>

      {/* Code + actions */}
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5">
        <p className="min-w-0 flex-1 text-lg font-black tracking-widest text-foreground truncate">
          {code || "…"}
        </p>
        <button
          type="button"
          onClick={copyCode}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
          aria-label="Copy referral code"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={shareWhatsApp}
          className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white hover:opacity-90 transition-opacity"
          aria-label="Share referral code on WhatsApp"
        >
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-background px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total rewards earned
          </p>
          <p className="text-lg font-bold text-green-600">
            {storeInfo.currency}
            {totalEarned.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background px-3 py-2.5">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Wallet className="h-3 w-3" /> Wallet balance
          </p>
          <p className="text-lg font-bold text-foreground">
            {storeInfo.currency}
            {walletBalance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* History */}
      {referrals.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Your referrals ({referrals.length})
          </p>
          {referrals.map((r) => {
            const meta = statusMeta[r.status] || {
              label: r.status,
              cls: "bg-muted text-muted-foreground",
            };
            return (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5"
              >
                <div>
                  <p className="text-xs font-semibold text-foreground">Code used · {r.referral_code}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {r.rewarded_at &&
                      ` · rewarded ${new Date(r.rewarded_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}`}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>
                    {meta.label}
                  </span>
                  <p className="mt-0.5 text-xs font-bold text-green-600">
                    +{storeInfo.currency}
                    {Number(r.referrer_reward || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-background px-3 py-3 text-center text-[11px] text-muted-foreground">
          No referrals yet — share your code to start earning.
        </p>
      )}
    </div>
  );
};

export default ReferralSection;
