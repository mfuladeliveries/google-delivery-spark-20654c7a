import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, CreditCard, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadPendingPaymentOrder } from "@/lib/pendingPaymentOrder";

// Auto-submitting form that posts the user to PayFast's hosted checkout.
// We arrive here from CheckoutDialog after the order has been created in
// `pending_payment` status. Nav state must contain { orderId, orderNumber, total }.
interface PayState {
  orderId: string;
  orderNumber: number | string;
  total: number;
  restaurant?: string;
}

const PayFastRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as PayState | null) ?? loadPendingPaymentOrder();

  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const [processUrl, setProcessUrl] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.orderId) {
      navigate("/orders", { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke(
          "payfast-create-payment",
          {
            body: {
              order_id: state.orderId,
              return_origin: window.location.origin,
            },
          },
        );
        if (cancelled) return;
        if (fnErr || !data?.process_url || !data?.fields) {
          setError(
            (fnErr as Error)?.message ||
              "Could not start PayFast checkout. Please try again.",
          );
          return;
        }
        setProcessUrl(data.process_url);
        setFields(data.fields);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to start payment.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state, navigate]);

  // Auto-submit once we have fields.
  useEffect(() => {
    if (fields && processUrl && formRef.current) {
      // Tiny delay so the user sees the spinner instead of an instant redirect flash.
      const t = setTimeout(() => formRef.current?.submit(), 600);
      return () => clearTimeout(t);
    }
  }, [fields, processUrl]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full rounded-3xl border border-destructive/40 bg-card p-6 text-center shadow-card">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-3 font-display text-lg font-bold text-foreground">
            Payment couldn't start
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate("/orders", { replace: true })}
            className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
          >
            Back to orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-3xl border border-border bg-card p-6 text-center shadow-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CreditCard className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mt-3 font-display text-lg font-bold text-foreground">
          Securing your payment
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Redirecting you to PayFast for order #{state?.orderNumber}…
        </p>
        {typeof state?.total === "number" && (
          <p className="mt-2 font-display text-2xl font-bold text-primary">
            R{state.total.toFixed(2)}
          </p>
        )}
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Please don't close this
          window.
        </div>

        {fields && processUrl && (
          <form ref={formRef} action={processUrl} method="post" className="hidden">
            {Object.entries(fields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <button type="submit">Continue to PayFast</button>
          </form>
        )}

        {fields && processUrl && (
          <button
            type="button"
            onClick={() => formRef.current?.submit()}
            className="mt-5 w-full rounded-xl border border-border bg-background py-2.5 text-xs font-semibold text-muted-foreground"
          >
            Tap if not redirected automatically
          </button>
        )}

        {/* Sandbox test card info — visible while running against PayFast sandbox */}
        <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-left">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
            Sandbox test details
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Use these on the PayFast sandbox checkout — no real money is charged.
          </p>
          <dl className="mt-3 space-y-1.5 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Card number</dt>
              <dd className="font-mono font-semibold text-foreground">
                4000 0000 0000 0002
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Expiry</dt>
              <dd className="font-mono font-semibold text-foreground">12/30</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">CVV</dt>
              <dd className="font-mono font-semibold text-foreground">123</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">3D Secure password</dt>
              <dd className="font-mono font-semibold text-foreground">12345</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default PayFastRedirect;
