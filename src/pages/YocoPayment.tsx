import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CreditCard, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { clearPendingPaymentOrder, loadPendingPaymentOrder } from "@/lib/pendingPaymentOrder";
import { canPayOrder, paymentBreakdown, type OrderAmounts } from "@/lib/approvalPayment";
import { getYocoReturnOrigin } from "@/lib/yoco";

interface PaymentOrder extends OrderAmounts {
  id: string;
  order_number: number;
  restaurant: string;
  items: { name: string; quantity: number; price: number; size?: string; cut?: string; add_ons?: unknown[] }[];
  status: string;
  payment_status: string;
  payment_method: string;
  customer_lat: number | null;
  customer_lng: number | null;
  customer_address: string;
}

const money = (amount: number) => `R${Number(amount).toFixed(2)}`;

const YocoPayment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const nav = location.state as { orderId?: string } | null;
  const orderId = params.get("order_id") || nav?.orderId || loadPendingPaymentOrder()?.orderId;
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitingForDriver, setWaitingForDriver] = useState(false);
  const busyRef = useRef(false);
  const handedOff = useRef(false);

  const loadOrder = useCallback(async () => {
    if (!orderId || !user) return;
    const { data, error: readError } = await supabase.from("orders")
      .select("id,order_number,restaurant,items,status,payment_status,payment_method,subtotal,tax,delivery_fee,tip,total,discount_amount,credits_applied,customer_lat,customer_lng,customer_address")
      .eq("id", orderId).eq("user_id", user.id).maybeSingle();
    if (readError) { setError("Could not load your order. Check your connection and try again."); setLoading(false); return; }
    if (!data) { navigate("/orders", { replace: true }); return; }
    if (data.payment_status === "paid") {
      clearPendingPaymentOrder(data.order_number);
      navigate(`/payment/result?order=${data.order_number}&order_id=${data.id}`, { replace: true });
      return;
    }
    if (!canPayOrder(data)) {
      clearPendingPaymentOrder(data.order_number);
      navigate(`/order-confirmation?order=${data.order_number}`, { replace: true });
      return;
    }
    setOrder(data as unknown as PaymentOrder);
    setLoading(false);
    return data as unknown as PaymentOrder;
  }, [orderId, user?.id, navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (!orderId) { navigate("/orders", { replace: true }); return; }
    void loadOrder();
    const timer = window.setInterval(() => { if (!document.hidden && !busyRef.current) void loadOrder(); }, 10000);
    const onVisible = () => {
      if (document.hidden) return;
      if (handedOff.current && orderId) {
        navigate(`/payment/result?order_id=${orderId}`, { replace: true });
      } else void loadOrder();
    };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) onVisible(); };
    window.addEventListener("online", onVisible);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authLoading, loadOrder, orderId, navigate]);

  const startCheckout = async () => {
    if (busyRef.current || !order) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const fresh = await loadOrder();
      if (!fresh) return;
      if (!paymentBreakdown(fresh).matches) throw new Error("Your order total needs to be checked before payment. Please contact Mfula Deliveries.");
      // Preserve the existing coverage requirement, without hiding the order summary.
      if (fresh.customer_lat != null && fresh.customer_lng != null) {
        const { data: coverage, error: coverageError } = await supabase.rpc("check_area_coverage", {
          p_lat: fresh.customer_lat, p_lng: fresh.customer_lng, p_address: fresh.customer_address,
        });
        if (coverageError) throw new Error("Could not check driver availability. Please try again.");
        const result = (Array.isArray(coverage) ? coverage[0] : coverage) as { covered?: boolean } | null;
        if (result?.covered === false) { setWaitingForDriver(true); return; }
      }
      setWaitingForDriver(false);
      const { data, error: checkoutError } = await supabase.functions.invoke("yoco-create-checkout", {
        body: { order_id: fresh.id, return_origin: getYocoReturnOrigin() },
      });
      let payload = (data ?? {}) as { redirect_url?: string; already_paid?: boolean; error?: string };
      if (checkoutError) {
        const context = (checkoutError as unknown as { context?: Response }).context;
        if (context) { try { payload = { ...payload, ...await context.clone().json() }; } catch { /* Non-JSON error */ } }
      }
      if (payload.already_paid) { navigate(`/payment/result?order_id=${fresh.id}`, { replace: true }); return; }
      if (checkoutError || !payload.redirect_url) throw new Error(payload.error || "Could not start payment. Please try again.");
      handedOff.current = true;
      sessionStorage.setItem(`yoco_handoff_${fresh.id}`, "1");
      window.location.assign(payload.redirect_url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start payment.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const breakdown = order ? paymentBreakdown(order) : null;
  return (
    <div className="min-h-screen bg-background pb-12">
      <main className="mx-auto max-w-lg px-4 pt-6">
        <Button variant="ghost" onClick={() => navigate("/orders")}><ArrowLeft /> Orders</Button>
        <h1 className="mt-6 font-display text-2xl font-bold text-foreground">Payment</h1>
        {loading ? <div className="flex items-center gap-3 py-10 text-muted-foreground"><Loader2 className="animate-spin" /> Loading your accepted order…</div> : order && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">Order #{order.order_number} · {order.restaurant}</p>
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="h-4 w-4" /> Accepted — pending payment</p>
            <ul className="mt-6 divide-y divide-border border-y border-border">
              {order.items.map((item, index) => (
                <li key={index} className="flex items-start justify-between gap-4 py-4">
                  <div className="min-w-0"><p className="break-words font-semibold text-foreground">{item.quantity} × {item.name}</p><p className="mt-1 text-xs text-muted-foreground">{money(item.price)} each{item.size ? ` · ${item.size}` : ""}{item.cut ? ` · ${item.cut}` : ""}</p></div>
                  <span className="shrink-0 text-sm font-semibold text-foreground">{money(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-6 space-y-3 text-sm text-foreground">
              {[["Food subtotal", order.subtotal], ["Delivery fee", order.delivery_fee], ["Service fee", order.tax], ...(order.tip ? [["Driver tip", order.tip]] : []), ...(order.discount_amount ? [["Discount", -order.discount_amount]] : []), ...(order.credits_applied ? [["Wallet credits", -order.credits_applied]] : [])].map(([label, amount]) => <div key={String(label)} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd>{money(Number(amount))}</dd></div>)}
              <div className="flex justify-between gap-4 border-t border-border pt-4 text-xl font-bold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
            </dl>
            {!breakdown?.matches && <p role="alert" className="mt-4 text-sm text-destructive">The saved total does not match the fee breakdown. Please contact Mfula Deliveries before paying.</p>}
            {waitingForDriver && <p role="status" className="mt-4 text-sm text-muted-foreground">No drivers are online in your area yet. Your order remains pending payment; try again shortly.</p>}
            <Button size="lg" className="mt-6 w-full" disabled={busy || !breakdown?.matches} onClick={startCheckout}>{busy ? <Loader2 className="animate-spin" /> : error || waitingForDriver ? <RefreshCw /> : <CreditCard />}{busy ? "Opening secure checkout…" : error || waitingForDriver ? "Retry payment" : `Pay ${money(order.total)} with Yoco`}</Button>
          </>
        )}
        {error && <div role="alert" className="mt-4 flex gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" /><p>{error}</p></div>}
        {!loading && !order && error && <Button className="mt-4" onClick={() => { setError(null); setLoading(true); void loadOrder(); }}><RefreshCw /> Retry</Button>}
      </main>
    </div>
  );
};
export default YocoPayment;
