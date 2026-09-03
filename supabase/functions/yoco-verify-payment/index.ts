// Server-side verification of a Yoco checkout, used when the customer returns
// from the hosted checkout. Never trusts redirect query params — it re-reads the
// checkout from Yoco and applies the same confirmation logic as the webhook.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import {
  centsToRands,
  confirmPaidOrder,
  getYocoCheckout,
  runPostPaymentSideEffects,
} from "../_shared/yoco.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Not authenticated" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const body = (await req.json().catch(() => ({}))) as {
      order_id?: string;
      order_number?: string | number;
    };

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    let query = admin
      .from("orders")
      .select(
        "id, user_id, order_number, total, status, payment_status, payment_checkout_id, payment_provider_txn_id, delivery_code, payment_failure_reason",
      );
    if (body.order_id) query = query.eq("id", body.order_id);
    else if (body.order_number) query = query.eq("order_number", Number(body.order_number));
    else return json({ error: "order_id or order_number required" }, 400);

    const { data: order } = await query.maybeSingle();
    if (!order) return json({ error: "Order not found" }, 404);
    if (order.user_id !== user.id) return json({ error: "Not your order" }, 403);

    const respond = (extra: Record<string, unknown> = {}) =>
      json({
        order_id: order.id,
        order_number: order.order_number,
        total: Number(order.total),
        status: order.status,
        payment_status: order.payment_status,
        ...extra,
      });

    if (order.payment_status === "paid" || order.status !== "pending_payment") {
      return respond({ payment_status: "paid", delivery_code: order.delivery_code });
    }

    if (!order.payment_checkout_id) {
      return respond({ checkout_status: "none" });
    }

    const checkout = await getYocoCheckout(order.payment_checkout_id);
    const checkoutStatus = String(checkout?.status ?? "").toLowerCase();

    if (checkoutStatus === "completed" || checkoutStatus === "succeeded") {
      const result = await confirmPaidOrder(admin, {
        orderId: order.id,
        paymentId: (checkout?.paymentId as string | null) ?? null,
        checkoutId: order.payment_checkout_id,
        reference: `MFULA-${order.order_number}`,
        amountGross: centsToRands(Number(checkout?.amount ?? 0)),
        paymentMethod: "card",
        currency: String(checkout?.currency ?? "ZAR"),
        payload: (checkout ?? {}) as Record<string, unknown>,
      });
      if (result) await runPostPaymentSideEffects(admin, result);

      const { data: fresh } = await admin
        .from("orders")
        .select("status, payment_status, delivery_code")
        .eq("id", order.id)
        .maybeSingle();

      return json({
        order_id: order.id,
        order_number: order.order_number,
        total: Number(order.total),
        status: fresh?.status ?? "ready",
        payment_status: fresh?.payment_status ?? "paid",
        delivery_code: fresh?.delivery_code ?? null,
        checkout_status: checkoutStatus,
      });
    }

    if (checkoutStatus === "failed" || checkoutStatus === "cancelled") {
      await admin.rpc("mark_online_payment_failed", {
        p_order_id: order.id,
        p_provider: "yoco",
        p_payment_id: (checkout?.paymentId as string | null) ?? null,
        p_status: checkoutStatus,
        p_reason: checkoutStatus,
        p_raw_payload: (checkout ?? {}) as Record<string, unknown>,
        p_source_ip: null,
      });
      return respond({ payment_status: checkoutStatus, checkout_status: checkoutStatus });
    }

    return respond({ checkout_status: checkoutStatus || "processing" });
  } catch (err) {
    console.error("yoco-verify-payment error", err);
    return json({ error: err instanceof Error ? err.message : "Verification failed" }, 500);
  }
});
