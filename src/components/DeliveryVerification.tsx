import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldAlert, RefreshCw, LifeBuoy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface DeliveryVerificationProps {
  orderId: string;
  onVerified: () => void;
}

const DeliveryVerification = ({ orderId, onVerified }: DeliveryVerificationProps) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<string | null>(null);

  // Keep the driver's view of the admin decision fresh without a page refresh.
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data } = await supabase.rpc("driver_pin_override_status" as any, {
        p_order_id: orderId,
      });
      if (alive) setOverrideStatus((data as string | null) ?? null);
    };
    check();
    const timer = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [orderId]);

  const handleVerify = async () => {
    if (code.length < 6) return;
    setError("");
    setLoading(true);

    const { data, error: rpcError } = await supabase.rpc("verify_and_complete_delivery", {
      p_order_id: orderId,
      p_code: code,
    });

    if (rpcError) {
      console.error("PIN verification failed", rpcError);
      setError(rpcError.message || "Verification failed. Please try again.");
    } else if (data === true) {
      onVerified();
    } else {
      setError("Invalid code. Please check with the customer.");
    }
    setLoading(false);
  };

  const handleResendToCustomer = async () => {
    setResending(true);
    const { error: rpcError } = await supabase.rpc("driver_resend_customer_pin" as any, {
      p_order_id: orderId,
    });
    if (rpcError) {
      console.error("resend customer PIN failed", rpcError);
      toast.error(rpcError.message || "Could not send a new PIN");
    } else {
      setResent(true);
      setCode("");
      toast.success("A new PIN is now showing on the customer's order screen");
    }
    setResending(false);
  };

  const handleRequestAdmin = async () => {
    setRequesting(true);
    const { error: rpcError } = await supabase.rpc("driver_request_pin_override" as any, {
      p_order_id: orderId,
    });
    if (rpcError) {
      console.error("pin override request failed", rpcError);
      toast.error(rpcError.message || "Could not send the request");
    } else {
      setOverrideStatus("requested");
      toast.success("Admin has been asked to help. Please wait for approval.");
    }
    setRequesting(false);
  };

  const handleCompleteWithOverride = async () => {
    setCompleting(true);
    const { data, error: rpcError } = await supabase.rpc("driver_complete_with_override" as any, {
      p_order_id: orderId,
    });
    if (rpcError || data !== true) {
      console.error("override completion failed", rpcError);
      toast.error(rpcError?.message || "Admin approval is still needed");
    } else {
      toast.success("Delivery completed with admin approval");
      onVerified();
    }
    setCompleting(false);
  };

  return (
    <div className="space-y-3 rounded-2xl border-2 border-primary bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
        <ShieldCheck className="h-5 w-5 text-primary" />
        Enter customer's 6-digit delivery PIN
      </div>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="000000"
        className="w-full rounded-xl border-2 border-border bg-card px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button
        onClick={handleVerify}
        disabled={loading || code.length < 6}
        className="btn-glow w-full min-h-12 rounded-xl gradient-maroon px-5 py-3.5 text-base font-bold text-primary-foreground disabled:opacity-50"
      >
        {loading ? "Verifying…" : "Submit PIN & Complete Delivery"}
      </button>
      {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

      {/* Customer did not receive the PIN */}
      {!helpOpen ? (
        <button
          onClick={() => setHelpOpen(true)}
          className="w-full min-h-11 rounded-xl border-2 border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground"
        >
          Customer did not receive PIN
        </button>
      ) : (
        <div className="space-y-2.5 rounded-xl border border-border bg-card p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ShieldAlert className="h-4 w-4 text-primary" /> No PIN? Try this first
          </p>
          <button
            onClick={handleResendToCustomer}
            disabled={resending}
            className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-bold text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
            {resending ? "Sending…" : "Send the customer a new PIN"}
          </button>
          <p className="text-xs text-muted-foreground">
            {resent
              ? "Ask the customer to open their order screen — the new PIN is shown there. Then enter it above."
              : "The customer can also tap “Resend PIN” on their own order screen."}
          </p>

          {overrideStatus === "approved" ? (
            <button
              onClick={handleCompleteWithOverride}
              disabled={completing}
              className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--driver-success))] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {completing ? "Completing…" : "Complete Delivery (admin approved)"}
            </button>
          ) : overrideStatus === "requested" ? (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
              Waiting for admin approval. You cannot complete this delivery yet.
            </p>
          ) : overrideStatus === "rejected" ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              Admin did not approve completing without a PIN. Please call the customer.
            </p>
          ) : (
            <button
              onClick={handleRequestAdmin}
              disabled={requesting}
              className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-primary px-4 py-2.5 text-sm font-bold text-primary disabled:opacity-50"
            >
              <LifeBuoy className="h-4 w-4" />
              {requesting ? "Sending…" : "Still no PIN — ask admin for help"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryVerification;
