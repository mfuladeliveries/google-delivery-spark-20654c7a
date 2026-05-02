import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Clock, KeyRound, StickyNote, Navigation, Package, Home, ListOrdered, Loader2, RefreshCw } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RestaurantName } from "@/components/RestaurantName";
import { clearPendingPaymentOrder, loadPendingPaymentOrder } from "@/lib/pendingPaymentOrder";

interface ConfirmationState {
  orderNumber: string | number;
  deliveryPin: string;
  scheduledLabel?: string; // empty/undefined means ASAP
  foodNote?: string;
  deliveryInstructions?: string;
  total?: number;
  paymentMethod?: "cash" | "online";
  restaurant?: string;
  paymentPending?: boolean;
}

// Parse our combined special_notes string (created in CheckoutDialog) into parts.
// Format example:
//   "Food note: no onions | Delivery instructions: gate code 1234 | Scheduled for: Today 18:30"
//   "Deliver ASAP"
const parseSpecialNotes = (raw: string | null | undefined) => {
  const out: { foodNote?: string; deliveryInstructions?: string; scheduledLabel?: string } = {};
  if (!raw) return out;
  const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.startsWith("food note:")) {
      out.foodNote = part.slice("food note:".length).trim();
    } else if (lower.startsWith("delivery instructions:")) {
      out.deliveryInstructions = part.slice("delivery instructions:".length).trim();
    } else if (lower.startsWith("scheduled for:")) {
      out.scheduledLabel = part.slice("scheduled for:".length).trim();
    }
    // "Deliver ASAP" → leave scheduledLabel undefined
  }
  return out;
};

const OrderConfirmation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const navState = location.state as ConfirmationState | null;

  // Determine which order number to look up: from nav state OR ?order=123 query param
  const queryOrderNumber = searchParams.get("order");
  const cachedPendingOrder = loadPendingPaymentOrder(queryOrderNumber);

  const [data, setData] = useState<ConfirmationState | null>(() =>
    navState ??
    (cachedPendingOrder
      ? {
          orderNumber: cachedPendingOrder.orderNumber,
          deliveryPin: "------",
          total: cachedPendingOrder.total,
          paymentMethod: "online",
          restaurant: cachedPendingOrder.restaurant,
          paymentPending: true,
        }
      : null),
  );
  const [loading, setLoading] = useState(!navState && !cachedPendingOrder);
  const [notFound, setNotFound] = useState(false);

  const lookupOrderNumber = navState?.orderNumber ?? queryOrderNumber ?? null;

  // Keep ?order=N in the URL so refresh works
  useEffect(() => {
    if (navState?.orderNumber && !queryOrderNumber) {
      const params = new URLSearchParams(searchParams);
      params.set("order", String(navState.orderNumber));
      navigate(`/order-confirmation?${params.toString()}`, {
        replace: true,
        state: navState,
      });
    }
  }, [navState, queryOrderNumber, navigate, searchParams]);

  // Fetch from DB when we don't already have full state (e.g. after refresh)
  useEffect(() => {
    if (!lookupOrderNumber) return;
    if (authLoading) return;
    if (!user) {
      // Not signed in — can't fetch their order; bounce to orders page (will redirect to auth if needed)
      navigate("/orders", { replace: true });
      return;
    }

    const orderNumInt = Number(lookupOrderNumber);
    if (!Number.isFinite(orderNumInt)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchFullOrder = async () => {
      const { data: order, error } = await supabase
        .from("orders")
        .select(
          "order_number, delivery_code, special_notes, total, payment_method, restaurant, user_id, status, payment_status"
        )
        .eq("order_number", orderNumInt)
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return false;

      if (error || !order) {
        return false;
      }

      const parsed = parseSpecialNotes(order.special_notes);
      setData({
        orderNumber: order.order_number,
        deliveryPin: order.delivery_code || "------",
        scheduledLabel: parsed.scheduledLabel,
        foodNote: parsed.foodNote,
        deliveryInstructions: parsed.deliveryInstructions,
        total: typeof order.total === "number" ? order.total : Number(order.total),
        paymentMethod: (order.payment_method as "cash" | "online") || undefined,
        restaurant: order.restaurant || undefined,
        paymentPending: order.status === "pending_payment",
      });

      if (order.payment_status === "paid" || order.status !== "pending_payment") {
        clearPendingPaymentOrder(order.order_number);
      }

      return true;
    };

    const load = async () => {
      setLoading((prev) => (data ? prev : true));

      // Lightweight status poll via dedicated edge function — returns the
      // freshest status/payment_status without pulling the full row each time.
      const { data: statusData, error: statusErr } = await supabase.functions.invoke(
        "get-order-status",
        { body: { orderNumber: orderNumInt } }
      );

      if (cancelled) return;

      if (statusErr || !statusData || (statusData as any).error) {
        const recovered = await fetchFullOrder();
        if (!recovered) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      const status = (statusData as any).status as string;
      const paymentStatus = (statusData as any).payment_status as string | undefined;

      // Payment is still being confirmed by PayFast (ITN webhook is async).
      // Show a friendly "confirming payment" state and poll until it flips.
      if (status === "pending_payment") {
        const totalRaw = (statusData as any).total;
        setData({
          orderNumber: (statusData as any).order_number,
          deliveryPin: (statusData as any).delivery_code || "------",
          total: typeof totalRaw === "number" ? totalRaw : Number(totalRaw),
          paymentMethod: ((statusData as any).payment_method as "cash" | "online") || undefined,
          restaurant: (statusData as any).restaurant || undefined,
          paymentPending: true,
        });
        setLoading(false);
        pollTimer = setTimeout(load, 3000);
        return;
      }

      const recovered = await fetchFullOrder();
      if (!recovered) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (paymentStatus === "paid") {
        clearPendingPaymentOrder((statusData as any).order_number ?? orderNumInt);
      }

      setLoading(false);
    };

    setLoading(true);
    load();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [lookupOrderNumber, user, authLoading, navigate]);

  // If there's nothing to look up at all, send to Orders
  useEffect(() => {
    if (!lookupOrderNumber && !navState) {
      navigate("/orders", { replace: true });
    }
  }, [lookupOrderNumber, navState, navigate]);

  // If lookup failed (wrong order, not yours), bounce to Orders
  useEffect(() => {
    if (notFound) {
      navigate("/orders", { replace: true });
    }
  }, [notFound, navigate]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background pb-nav">
        <main className="mx-auto flex max-w-lg items-center justify-center px-4 pt-24">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading your order…</p>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background pb-nav">
        <main className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 pt-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
            Finalising your order…
          </h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            We're reconnecting to your latest payment update. This page will refresh automatically.
          </p>
        </main>
        <BottomNav />
      </div>
    );
  }

  const {
    orderNumber,
    deliveryPin,
    scheduledLabel,
    foodNote,
    deliveryInstructions,
    total,
    paymentMethod,
    restaurant,
    paymentPending,
  } = data;

  return (
    <div className="min-h-screen bg-background pb-nav">
      <main className="mx-auto max-w-lg px-4 pt-8 md:pt-12">
        {/* Success header */}
        <div className="flex flex-col items-center text-center">
          <div className={`flex h-20 w-20 items-center justify-center rounded-full ${paymentPending ? "bg-muted" : "bg-primary/10"}`}>
            {paymentPending ? (
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="h-12 w-12 text-primary" strokeWidth={2.2} />
            )}
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
            {paymentPending ? "Confirming payment…" : "Order Confirmed!"}
          </h1>
          {paymentPending ? (
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              We're waiting for PayFast to confirm your payment. This usually takes a few seconds — this page will update automatically.
            </p>
          ) : restaurant ? (
            <div className="mt-2 space-y-0.5">
              <p className="text-sm text-muted-foreground">Your order from</p>
              <RestaurantName as="p" size="xl" name={restaurant} />
              <p className="text-sm text-muted-foreground">has been confirmed! 🎉</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Thanks for ordering with us — we'll keep you updated.
            </p>
          )}
        </div>

        {/* Order number */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-center shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Order Number
          </p>
          <p className="mt-1 font-display text-3xl font-bold text-primary">
            #{orderNumber}
          </p>
        </div>

        {/* Delivery PIN */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">Delivery PIN</p>
            <p className="text-[11px] text-muted-foreground">
              Share this with the driver on arrival
            </p>
          </div>
          <p className="font-display text-2xl font-bold tracking-[0.2em] text-primary">
            {deliveryPin}
          </p>
        </div>

        {/* Delivery time */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-secondary">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">Delivery Time</p>
            <p className="mt-0.5 text-sm font-bold text-foreground">
              {scheduledLabel ? scheduledLabel : "As soon as possible (ASAP)"}
            </p>
            {!scheduledLabel && (
              <p className="text-[11px] text-muted-foreground">
                A driver will be assigned shortly
              </p>
            )}
          </div>
        </div>

        {/* Notes block (only if any present) */}
        {(foodNote || deliveryInstructions) && (
          <div className="mt-3 space-y-2 rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your Notes
            </p>
            {foodNote && (
              <div className="flex gap-2.5 rounded-xl bg-secondary/60 p-3">
                <StickyNote className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-foreground">
                    Food note
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground break-words">
                    {foodNote}
                  </p>
                </div>
              </div>
            )}
            {deliveryInstructions && (
              <div className="flex gap-2.5 rounded-xl bg-secondary/60 p-3">
                <Navigation className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-foreground">
                    Delivery instructions
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground break-words">
                    {deliveryInstructions}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Total + payment */}
        {(typeof total === "number" || paymentMethod) && (
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total</p>
              {typeof total === "number" && (
                <p className="font-display text-xl font-bold text-foreground">
                  R{total.toFixed(2)}
                </p>
              )}
            </div>
            {paymentMethod && (
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                paymentMethod === "cash"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
              }`}>
                {paymentMethod === "cash" ? "💵 Cash on delivery" : "💳 Paid online (PayFast)"}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            to="/orders"
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-display text-sm font-bold text-primary-foreground shadow-orange transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <ListOrdered className="h-4 w-4" />
            Track Order
          </Link>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 font-display text-sm font-bold text-foreground transition-colors hover:bg-secondary"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <Package className="h-3 w-3" />
          We'll send push updates as your order progresses.
        </p>
      </main>
      <BottomNav />
    </div>
  );
};

export default OrderConfirmation;
