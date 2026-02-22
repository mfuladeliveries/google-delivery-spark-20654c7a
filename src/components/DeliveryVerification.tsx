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
    if (code.length < 4) return;
    setError("");
    setLoading(true);

    const { data } = await supabase
      .from("orders")
      .select("delivery_code")
      .eq("id", orderId)
      .single();

    if (data?.delivery_code === code) {
      await supabase.from("orders").update({ status: "delivered" }).eq("id", orderId);
      onVerified();
    } else {
      setError("Invalid code. Please check with the customer.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Enter customer's delivery code
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="0000"
          className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-center text-lg tracking-[0.5em] text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleVerify}
          disabled={loading || code.length < 4}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {loading ? "..." : "Verify"}
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

export default DeliveryVerification;
