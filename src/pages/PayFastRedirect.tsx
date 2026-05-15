import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, CreditCard, AlertTriangle, RefreshCw, Bike } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearPendingPaymentOrder, loadPendingPaymentOrder } from "@/lib/pendingPaymentOrder";
import { toast } from "sonner";

interface PayState {
  orderId: string;
  orderNumber: number | string;
  total: number;
  restaurant?: string;
}

const PayFastRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const state = useMemo<PayState | null>(() => {
    const nav = location.state as PayState | null;
    if (nav?.orderId) return nav;
    const stored = loadPendingPaymentOrder();
    if (stored?.orderId)
      return {
        orderId: stored.orderId,
        orderNumber: stored.orderNumber,
        total: stored.total,
        restaurant: stored.restaurant,
      };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const [processUrl, setProcessUrl] = useState<string>("");
  const [retrying, setRetrying] = useState(false);
  const [waitingForDriver, setWaitingForDriver] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const calledRef = useRef(false);
  const busyRef = useRef(false);

  const invokePayment = useCallback(async () => {
    if (!state?.orderId || busyRef.current) return;
    busyRef.current = true;
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("payfast-create-payment", {
        body: {
          order_id: state.orderId,
          return_origin: window.location.origin,
        },
      });

      if (data && typeof data === "object" && (data as Record<string, unknown>).fallback) {
        setError("Payment service is temporarily unavailable. Please try again shortly.");
        return;
      }

      if (fnErr || !data?.process_url || !data?.fields) {
        const msg =
          (fnErr as Error)?.message ||
          (data && typeof data === "object" && (data as Record<string, unknown>).error
            ? String((data as Record<string, unknown>).error)
            : null) ||
          "Could not start PayFast checkout. Please try again.";
        setError(msg);
        return;
      }
      setProcessUrl(data.process_url);
      setFields(data.fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start payment.");
    } finally {
      busyRef.current = false;
    }
  }, [state]);

  // Before launching PayFast, ensure a driver is online for this order's area.
  // If none, hold on a "Waiting for driver…" screen and re-poll every 15s.
  useEffect(() => {
    if (!state?.orderId) {
      navigate("/orders", { replace: true });
      return;
    }
    if (calledRef.current) return;
    calledRef.current = true;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      const { data: order } = await supabase
        .from("orders")
        .select("customer_lat, customer_lng, customer_address")
        .eq("id", state.orderId)
        .maybeSingle();

      const lat = order?.customer_lat as number | null | undefined;
      const lng = order?.customer_lng as number | null | undefined;
      const addr = (order?.customer_address as string | null | undefined) ?? "";

      const poll = async () => {
        if (cancelled) return;
        if (typeof lat !== "number" || typeof lng !== "number") {
          setWaitingForDriver(false);
          invokePayment();
          return;
        }
        const { data: cov } = await supabase.rpc("check_area_coverage", {
          p_lat: lat,
          p_lng: lng,
          p_address: addr,
        });
        if (cancelled) return;
        const row = (Array.isArray(cov) ? cov[0] : cov) as
          | { covered: boolean }
          | null;
        if (row && !row.covered) {
          setWaitingForDriver(true);
          timer = setTimeout(poll, 15000);
          return;
        }
        setWaitingForDriver(false);
        invokePayment();
      };

      poll();
    };

    run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [state, navigate, invokePayment]);

  const handleRetry = async () => {
    if (busyRef.current) return;
    setRetrying(true);
    await invokePayment();
    setRetrying(false);
  };

  // Auto-submit once we have fields.
  useEffect(() => {
    if (fields && processUrl && formRef.current) {
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
            onClick={handleRetry}
            disabled={retrying}
            className="btn-glow mt-5 w-full rounded-xl gradient-maroon py-3 text-sm font-bold text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "Retrying…" : "Retry payment"}
          </button>
          <button
            onClick={() => navigate("/orders", { replace: true })}
            className="mt-3 w-full rounded-xl border border-border bg-background py-3 text-sm font-bold text-foreground"
          >
            Back to orders
          </button>
        </div>
      </div>
    );
  }

  if (waitingForDriver) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full rounded-3xl border border-amber-500/40 bg-card p-6 text-center shadow-card">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15">
            <Bike className="h-7 w-7 text-amber-600" />
          </div>
          <h1 className="mt-3 font-display text-lg font-bold text-foreground">
            Waiting for driver…
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No drivers are online in your area right now. We'll start your payment as soon as one
            comes online — please keep this screen open.
          </p>
          {typeof state?.total === "number" && (
            <p className="mt-3 font-display text-2xl font-bold text-primary">
              R{state.total.toFixed(2)}
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Order #{state?.orderNumber}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking again every 15 seconds…
          </div>
          <button
            onClick={() => navigate("/orders", { replace: true })}
            className="mt-5 w-full rounded-xl border border-border bg-background py-3 text-sm font-bold text-foreground"
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
          <Loader2 className="h-4 w-4 animate-spin" /> Please don't close this window.
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

        {/* Sandbox test card info — only shown in dev/sandbox builds, hidden in production */}
        {import.meta.env.DEV && (
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
                <dd className="font-mono font-semibold text-foreground">4000 0000 0000 0002</dd>
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
        )}
      </div>
    </div>
  );
};

export default PayFastRedirect;
