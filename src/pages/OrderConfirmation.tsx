import { useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, Clock, KeyRound, StickyNote, Navigation, Package, Home, ListOrdered } from "lucide-react";
import BottomNav from "@/components/BottomNav";

interface ConfirmationState {
  orderNumber: string | number;
  deliveryPin: string;
  scheduledLabel?: string; // empty/undefined means ASAP
  foodNote?: string;
  deliveryInstructions?: string;
  total?: number;
  paymentMethod?: "cash" | "online";
  restaurant?: string;
}

const OrderConfirmation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ConfirmationState | null;

  // If user lands here directly without state, send them to Orders
  useEffect(() => {
    if (!state || !state.orderNumber) {
      navigate("/orders", { replace: true });
    }
  }, [state, navigate]);

  if (!state || !state.orderNumber) return null;

  const {
    orderNumber,
    deliveryPin,
    scheduledLabel,
    foodNote,
    deliveryInstructions,
    total,
    paymentMethod,
    restaurant,
  } = state;

  return (
    <div className="min-h-screen bg-background pb-nav">
      <main className="mx-auto max-w-lg px-4 pt-8 md:pt-12">
        {/* Success header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-12 w-12 text-primary" strokeWidth={2.2} />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
            Order Confirmed!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Thanks for ordering with us — we'll keep you updated.
          </p>
        </div>

        {/* Order number */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-center shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Order Number
          </p>
          <p className="mt-1 font-display text-3xl font-bold text-primary">
            #{orderNumber}
          </p>
          {restaurant && (
            <p className="mt-1 text-xs text-muted-foreground">🍽️ {restaurant}</p>
          )}
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
                {paymentMethod === "cash" ? "💵 Cash on delivery" : "💳 Paid online"}
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
