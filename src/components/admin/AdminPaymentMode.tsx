import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, CreditCard, FlaskConical, Loader2, ShieldCheck } from "lucide-react";

type Mode = "live" | "test";

const AdminPaymentMode = () => {
  const [mode, setMode] = useState<Mode>("live");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Mode | null>(null);
  const [testOrders, setTestOrders] = useState<number>(0);

  const load = async () => {
    const [{ data: setting }, { count }] = await Promise.all([
      supabase.from("app_settings").select("value").eq("key", "payment_mode").maybeSingle(),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("payment_environment", "test"),
    ]);
    const value = (setting?.value ?? {}) as { mode?: string };
    setMode(value.mode === "test" ? "test" : "live");
    setTestOrders(count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (next: Mode) => {
    if (next === mode) return;
    setSaving(next);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        {
          key: "payment_mode",
          value: { mode: next },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    setSaving(null);
    if (error) {
      toast.error("Could not change the payment mode. Please try again.");
      return;
    }
    setMode(next);
    toast.success(
      next === "test"
        ? "Test mode is on — new payments will not charge real money."
        : "Live mode is on — payments will charge real money again.",
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading payment settings…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-foreground">💳 Payment Mode</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Choose whether new online payments charge real money or run as safe tests.
          Orders already created keep the mode they were paid in.
        </p>
      </div>

      <div
        className={`rounded-2xl border p-4 ${
          mode === "test"
            ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
            : "border-border bg-card"
        }`}
      >
        <div className="flex items-center gap-2">
          {mode === "test"
            ? <FlaskConical className="h-5 w-5 text-amber-600" />
            : <ShieldCheck className="h-5 w-5 text-primary" />}
          <span className="font-bold text-sm text-foreground">
            Currently: {mode === "test" ? "TEST MODE — no real money" : "LIVE — real payments"}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => save("live")}
            disabled={saving !== null}
            className={`rounded-xl border p-3 text-left transition ${
              mode === "live"
                ? "border-primary bg-primary/10"
                : "border-border hover:bg-secondary"
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <CreditCard className="h-4 w-4" /> Live payments
              {saving === "live" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Customers are charged for real using your live card details.
            </p>
          </button>

          <button
            onClick={() => save("test")}
            disabled={saving !== null}
            className={`rounded-xl border p-3 text-left transition ${
              mode === "test"
                ? "border-amber-500 bg-amber-100/60 dark:bg-amber-950/40"
                : "border-border hover:bg-secondary"
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <FlaskConical className="h-4 w-4" /> Test payments
              {saving === "test" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Uses test card details only. No money moves, and every order is marked TEST.
            </p>
          </button>
        </div>

        {mode === "test" && (
          <div className="mt-4 flex gap-2 rounded-xl bg-amber-100 dark:bg-amber-950/50 p-3 text-[11px] text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>
              While test mode is on, real customers cannot pay for real. Switch back to Live
              as soon as you finish testing.
            </p>
          </div>
        )}

        <p className="mt-3 text-[11px] text-muted-foreground">
          Test orders so far: <span className="font-bold">{testOrders}</span>
        </p>
      </div>
    </div>
  );
};

export default AdminPaymentMode;
