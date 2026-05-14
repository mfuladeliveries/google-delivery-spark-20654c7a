import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck } from "lucide-react";

interface DeliveryVerificationProps {
  orderId: string;
  onVerified: () => void;
}

const DeliveryVerification = ({ orderId, onVerified }: DeliveryVerificationProps) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length < 6) return;
    setError("");
    setLoading(true);

    const { data, error: rpcError } = await supabase.rpc("verify_and_complete_delivery", {
      p_order_id: orderId,
      p_code: code,
    });

    if (rpcError) {
      setError("Verification failed. Please try again.");
    } else if (data === true) {
      onVerified();
    } else {
      setError("Invalid code. Please check with the customer.");
    }
    setLoading(false);
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
    </div>
  );
};

export default DeliveryVerification;
