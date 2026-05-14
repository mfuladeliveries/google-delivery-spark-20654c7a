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
import BottomNav from "@/components/BottomNav";
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

  const requestedStatus = (searchParams.get("payment_status") ?? "").trim().toUpperCase();
  const cachedOrder = useMemo(
    () => loadPendingPaymentOrder(searchParams.get("order")),
    [searchParams],
  );
  const orderId = searchParams.get("m_payment_id") ?? cachedOrder?.orderId ?? "";
  const orderNumber = searchParams.get("order") ?? cachedOrder?.orderNumber ?? "";
  const amountGross =
    searchParams.get("amount_gross") ??
    (typeof cachedOrder?.total === "number" ? cachedOrder.total.toFixed(2) : "");
  const itemName =
    searchParams.get("item_name") ?? (orderNumber ? `Order #${orderNumber}` : "your order");

  // Redirect immediately if we have zero identifying information
  useEffect(() => {
    console.log("PayFast Return:", window.location.href);
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

    const body = orderId ? { orderId } : { orderNumber };
    const { data, error } = await supabase.functions.invoke("get-order-status", { body });

    if (error || !data || (data as { error?: string }).error) {
      setPhase(requestedStatus === "COMPLETE" ? "processing" : "failed");
      return false;
    }

    const payload = data as {
      order_number: number | string;
      total?: number | string;
      status?: string;
      payment_status?: string;
    };

    setResolvedOrderNumber(String(payload.order_number ?? orderNumber ?? ""));
    setResolvedTotal(
      typeof payload.total === "number"
        ? payload.total
        : Number(payload.total ?? cachedOrder?.total ?? 0),
    );

    if (payload.payment_status === "paid" || payload.status !== "pending_payment") {
      clearPersistedCart();
      clearPendingPaymentOrder(payload.order_number ?? orderNumber);
      setPhase("success");
      return true;
    }

    if (requestedStatus === "FAILED" || requestedStatus === "CANCELLED") {
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
    const timer = window.setTimeout(() => {
      navigate(`/order-confirmation?order=${resolvedOrderNumber}`, { replace: true });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [navigate, phase, resolvedOrderNumber]);

  const title =
    phase === "success"
      ? "Payment Successful"
      : phase === "failed"
        ? "Payment Failed or Cancelled"
        : requestedStatus === "COMPLETE"
          ? "Finalising your payment"
          : "Checking payment status";

  const description =
    phase === "success"
      ? `Your payment for ${itemName} has been confirmed.`
      : phase === "failed"
        ? "We couldn't confirm this payment return. You can refresh or check your orders."
        : "We're parsing the PayFast return and syncing your order safely.";

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

          <div className="mt-5 space-y-2 rounded-2xl border border-border bg-background p-4 text-left text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">payment_status</span>
              <span className="font-semibold text-foreground">{requestedStatus || "Missing"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">amount_gross</span>
              <span className="font-semibold text-foreground">{amountGross || "Missing"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">item_name</span>
              <span className="max-w-[60%] truncate font-semibold text-foreground">
                {itemName || "Missing"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">m_payment_id</span>
              <span className="max-w-[60%] truncate font-mono text-xs font-semibold text-foreground">
                {orderId || "Missing"}
              </span>
            </div>
          </div>

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
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default PaymentResult;
