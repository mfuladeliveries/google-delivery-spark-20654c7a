import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Home,
  KeyRound,
  ListOrdered,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { clearPersistedCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { clearPendingPaymentOrder, loadPendingPaymentOrder } from "@/lib/pendingPaymentOrder";

type ResultPhase = "loading" | "processing" | "success" | "failed";

const PaymentResult = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [phase, setPhase] = useState<ResultPhase>("loading");
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvedOrderNumber, setResolvedOrderNumber] = useState<string>("");
  const [resolvedTotal, setResolvedTotal] = useState<number | null>(null);
  const [deliveryPin, setDeliveryPin] = useState<string>("");

  // Yoco appends nothing to our return URLs — we control the query string
  // ourselves when creating the checkout. The status hint below is only used
  // for wording; payment truth always comes from the server.
  const requestedStatus = (searchParams.get("payment_status") ?? "").trim().toUpperCase();
  const cachedOrder = useMemo(
    () => loadPendingPaymentOrder(searchParams.get("order")),
    [searchParams],
  );
  const orderId = searchParams.get("order_id") ?? cachedOrder?.orderId ?? "";
  const orderNumber = searchParams.get("order") ?? cachedOrder?.orderNumber ?? "";
  const itemName = orderNumber ? `Order #${orderNumber}` : "your order";

  useEffect(() => {
    if (!orderId && !orderNumber && !cachedOrder) {
      navigate("/orders", { replace: true });
    }
  }, [orderId, orderNumber, cachedOrder, navigate]);

  const refreshStatus = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((key) => key + 1);
    window.setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const checkOrderStatus = useCallback(async () => {
    if (authLoading) {
      setPhase("loading");
      return false;
    }

    if (!orderId && !orderNumber) {
      setPhase("failed");
      return true;
    }

    if (!user) {
      setPhase(requestedStatus === "COMPLETE" ? "processing" : "failed");
      return false;
    }

    // Server-side verification against Yoco — never trust the redirect alone.
    const body = orderId ? { order_id: orderId } : { order_number: orderNumber };
    const { data, error } = await supabase.functions.invoke("yoco-verify-payment", { body });

    if (error || !data || (data as { error?: string }).error) {
      setPhase(requestedStatus === "COMPLETE" ? "processing" : "failed");
      return false;
    }

    const payload = data as {
      order_number: number | string;
      total?: number | string;
      status?: string;
      payment_status?: string;
      delivery_code?: string | null;
    };

    setResolvedOrderNumber(String(payload.order_number ?? orderNumber ?? ""));
    setResolvedTotal(
      typeof payload.total === "number"
        ? payload.total
        : Number(payload.total ?? cachedOrder?.total ?? 0),
    );
    if (payload.delivery_code) setDeliveryPin(payload.delivery_code);

    if (payload.payment_status === "paid" || payload.status !== "pending_payment") {
      clearPersistedCart();
      clearPendingPaymentOrder(payload.order_number ?? orderNumber);
      setPhase("success");
      return true;
    }

    if (
      payload.payment_status === "failed" ||
      payload.payment_status === "cancelled" ||
      requestedStatus === "FAILED" ||
      requestedStatus === "CANCELLED"
    ) {
      setPhase("failed");
      return true;
    }

    setPhase(requestedStatus === "COMPLETE" ? "processing" : "loading");
    return false;
  }, [authLoading, cachedOrder?.total, orderId, orderNumber, requestedStatus, user]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const run = async () => {
      const done = await checkOrderStatus();
      if (!cancelled && !done && (requestedStatus === "COMPLETE" || !!orderId || !!orderNumber)) {
        timer = window.setTimeout(run, 3000);
      }
    };

    run();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [checkOrderStatus, orderId, orderNumber, refreshKey, requestedStatus]);

  useEffect(() => {
    if (phase !== "success" || !resolvedOrderNumber) return;
    // Give the customer enough time to read & screenshot the delivery PIN
    // before bouncing them to the full order confirmation page.
    const timer = window.setTimeout(() => {
      navigate(`/order-confirmation?order=${resolvedOrderNumber}`, { replace: true });
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [navigate, phase, resolvedOrderNumber]);

  const title =
    phase === "success"
      ? "Payment Successful"
      : phase === "failed"
        ? "Payment Failed or Cancelled"
        : requestedStatus === "COMPLETE"
          ? "Confirming your payment"
          : "Checking payment status";

  const description =
    phase === "success"
      ? `Your payment for ${itemName} has been confirmed.`
      : phase === "failed"
        ? "We couldn't confirm this payment. Nothing has been charged for an unconfirmed order — you can retry from your orders."
        : "We're confirming your payment with Yoco. This usually takes a few seconds.";

  return (
    <div className="min-h-screen bg-background pb-nav">
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-lg flex-col items-center justify-center px-4 text-center">
        <div className="w-full rounded-3xl border border-border bg-card p-6 shadow-card">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            {phase === "success" ? (
              <CheckCircle2 className="h-10 w-10 text-primary" />
            ) : phase === "failed" ? (
              <AlertTriangle className="h-10 w-10 text-destructive" />
            ) : (
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            )}
          </div>

          <h1 className="mt-4 font-display text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>

          {(resolvedOrderNumber || orderNumber) && (
            <p className="mt-4 text-sm font-semibold text-primary">
              Order #{resolvedOrderNumber || orderNumber}
            </p>
          )}
          {typeof resolvedTotal === "number" && Number.isFinite(resolvedTotal) && (
            <p className="mt-1 font-display text-xl font-bold text-foreground">
              R{resolvedTotal.toFixed(2)}
            </p>
          )}

          {/* Delivery PIN — shown immediately after payment is approved so the
              customer can screenshot or memorise it before the redirect. */}
          {phase === "success" && deliveryPin && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 text-left">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">Your Delivery PIN</p>
                <p className="text-[11px] text-muted-foreground">
                  Share this with the driver on arrival
                </p>
              </div>
              <p className="font-display text-2xl font-bold tracking-[0.2em] text-primary">
                {deliveryPin}
              </p>
            </div>
          )}

          <button
            onClick={refreshStatus}
            disabled={refreshing}
            className="btn-glow mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl gradient-maroon px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh status"}
          </button>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Link
              to="/orders"
              className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-sm font-bold text-foreground"
            >
              <ListOrdered className="h-4 w-4" />
              Orders
            </Link>
            <Link
              to="/"
              className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-sm font-bold text-foreground"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
          </div>

          <p className="mt-4 text-[11px] text-muted-foreground">
            Payments are processed securely by Yoco. We never store your card details.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PaymentResult;
