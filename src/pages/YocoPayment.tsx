import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, CreditCard, AlertTriangle, RefreshCw, Bike, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearPendingPaymentOrder, loadPendingPaymentOrder } from "@/lib/pendingPaymentOrder";
import { getYocoReturnOrigin } from "@/lib/yoco";
import { toast } from "sonner";

interface PayState {
  orderId: string;
  orderNumber: number | string;
  total: number;
  restaurant?: string;
}

const YocoPayment = () => {
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
  const [retrying, setRetrying] = useState(false);
  const [waitingForDriver, setWaitingForDriver] = useState(false);
  const calledRef = useRef(false);
  const busyRef = useRef(false);

  const startCheckout = useCallback(async () => {
    if (!state?.orderId || busyRef.current) return;
    busyRef.current = true;
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("yoco-create-checkout", {
        body: {
          order_id: state.orderId,
          return_origin: getYocoReturnOrigin(),
        },
      });

      let payload = (data ?? {}) as {
        redirect_url?: string;
        already_paid?: boolean;
        error?: string;
      };

      // Non-2xx responses put the JSON body on the error's context.
      if (fnErr && !payload.redirect_url) {
        const ctx = (fnErr as unknown as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            payload = { ...payload, ...(await ctx.clone().json()) };
          } catch {
            /* ignore non-JSON bodies */
          }
        }
      }

      if (payload.already_paid) {
        navigate(`/payment/result?order=${state.orderNumber}&order_id=${state.orderId}`, {
          replace: true,
        });
        return;
      }

      // The order is no longer payable (cancelled, expired or already handled):
      // drop the stale saved order so we don't loop on this screen.
      if (payload.error === "This order is not awaiting payment.") {
        clearPendingPaymentOrder(state.orderNumber);
        toast.error("This order is no longer awaiting payment.");
        navigate("/orders", { replace: true });
        return;
      }

      if (fnErr || !payload.redirect_url) {
        setError(
          payload.error ||
            (fnErr as Error)?.message ||
            "Could not start the secure checkout. Please try again.",
        );
        return;
      }


      // Hand the customer over to Yoco's hosted checkout.
      window.location.href = payload.redirect_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start payment.");
    } finally {
      busyRef.current = false;
    }
  }, [state, navigate]);

  // Before launching the checkout, ensure a driver is online for this order's area.
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
          startCheckout();
          return;
        }
        const { data: cov } = await supabase.rpc("check_area_coverage", {
          p_lat: lat,
          p_lng: lng,
          p_address: addr,
        });
        if (cancelled) return;
        const row = (Array.isArray(cov) ? cov[0] : cov) as { covered: boolean } | null;
        if (row && !row.covered) {
          setWaitingForDriver(true);
          timer = setTimeout(poll, 15000);
          return;
        }
        setWaitingForDriver(false);
        startCheckout();
      };

      poll();
    };

    run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [state, navigate, startCheckout]);

  const handleRetry = async () => {
    if (busyRef.current) return;
    setRetrying(true);
    await startCheckout();
    setRetrying(false);
  };

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
          <p className="mt-1 text-[11px] text-muted-foreground">Order #{state?.orderNumber}</p>
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking again every 15 seconds…
          </div>
          <button
            onClick={async () => {
              if (!state?.orderId) return;
              if (!confirm("Cancel this order? Your payment won't be charged.")) return;
              const { error } = await supabase.rpc("customer_cancel_pending_order", {
                p_order_id: state.orderId,
              });
              if (error) {
                toast.error(error.message || "Could not cancel the order.");
                return;
              }
              clearPendingPaymentOrder(state.orderNumber);
              toast.success("Order cancelled.");
              navigate("/orders", { replace: true });
            }}
            className="mt-5 w-full rounded-xl border-2 border-destructive/40 bg-destructive/5 py-3 text-sm font-bold text-destructive"
          >
            Cancel order
          </button>
          <button
            onClick={() => navigate("/orders", { replace: true })}
            className="mt-2 w-full rounded-xl border border-border bg-background py-3 text-sm font-bold text-foreground"
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
          Taking you to Yoco's secure checkout for order #{state?.orderNumber}…
        </p>
        {typeof state?.total === "number" && (
          <p className="mt-2 font-display text-2xl font-bold text-primary">
            R{state.total.toFixed(2)}
          </p>
        )}
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Please don't close this window.
        </div>
        <p className="mt-4 inline-flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Card details are entered on Yoco's secure page — never on our servers.
        </p>
      </div>
    </div>
  );
};

export default YocoPayment;
