// Creates a Yoco hosted checkout for an order the caller owns.
// The amount is always taken from the DB order total — never from the client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import {
  createYocoCheckout,
  getPaymentMode,
  getYocoCheckout,
  isTestMode,
  normalizeMode,
  testKeyConfigured,
} from "../_shared/yoco.ts";

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { checkoutAction } from "../_shared/paymentRules.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let lease: { orderId: string; token: string } | null = null;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Not authenticated" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    const parsed = z.object({ order_id: z.string().uuid(), return_origin: z.string().url().max(2048) }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Invalid order or return address" }, 400);
    const body = parsed.data;
    const orderId = body.order_id;

    const origin = (() => {
      try {
        const u = new URL(body.return_origin ?? "");
        if (u.protocol !== "https:" && u.hostname !== "localhost") return null;
        return u.origin;
      } catch {
        return null;
      }
    })();
    if (!origin) return json({ error: "Invalid return_origin" }, 400);

    const { data: initialOrder, error: orderErr } = await admin
      .from("orders")
      .select(
        "id, user_id, order_number, total, status, payment_status, restaurant, payment_checkout_id, payment_environment",
      )
      .eq("id", orderId)
      .maybeSingle();

    let order = initialOrder;
    if (orderErr || !order) return json({ error: "Order not found" }, 404);
    if (order.user_id !== user.id) return json({ error: "Not your order" }, 403);
    if (order.payment_status === "paid") {
      return json({ already_paid: true, order_number: order.order_number });
    }
    if (order.status !== "pending_payment") {
      return json({ error: "This order is not awaiting payment." }, 409);
    }

    // Admin-selected environment. Test mode must never touch live credentials.
    let mode = order.payment_checkout_id ? normalizeMode(order.payment_environment) : await getPaymentMode(admin);
    if (mode === "test" && !testKeyConfigured()) {
      return json({
        error:
          "Test payment mode is on, but no Yoco test key is configured. Add a sk_test key or switch back to Live mode.",
      }, 409);
    }

    const total = Number(order.total);
    if (!Number.isFinite(total) || total <= 0) return json({ error: "Invalid order total" }, 400);

    const { data: claim, error: claimError } = await admin.rpc("claim_yoco_checkout", { p_order_id: order.id });
    if (claimError) return json({ error: claimError.message }, 409);
    if (claim?.already_paid) return json({ already_paid: true });
    if (claim?.busy || !claim?.lease_token) return json({ error: "Payment is already being opened. Please wait and retry." }, 409);
    lease = { orderId: order.id, token: claim.lease_token };
    let idempotencyKey = String(claim.idempotency_key);
    // Another request may have persisted a checkout between our first read and
    // this lease. Re-read under our exclusive attempt before touching Yoco.
    const { data: fresh, error: freshError } = await admin.from("orders")
      .select("id,user_id,order_number,total,status,payment_status,restaurant,payment_checkout_id,payment_environment")
      .eq("id", order.id).maybeSingle();
    if (freshError || !fresh) throw new Error("Could not refresh the reserved order");
    order = fresh;
    if (order.payment_checkout_id) mode = normalizeMode(order.payment_environment);
    if (Number(order.total) !== total) return json({ error: "Order prices changed. Please refresh before paying." }, 409);

    // Reuse an existing checkout when it is still usable (browser back / retry).
    if (order.payment_checkout_id) {
      const existing = await getYocoCheckout(order.payment_checkout_id, mode);
      const status = String(existing?.status ?? "").toLowerCase();
      const action = checkoutAction(status, !!existing?.redirectUrl);
      if (existing?.redirectUrl && action === "reuse") {
        return json({
          checkout_id: existing.id,
          redirect_url: existing.redirectUrl,
          order_number: order.order_number,
          total,
          test_mode: isTestMode(mode),
          payment_mode: mode,
          reused: true,
        });
      }
      if (!existing) return json({ error: "Could not verify your existing payment. Please refresh its status before retrying." }, 409);
      if (action === "confirm") return json({ error: "Payment was received. Please refresh payment status; do not pay again." }, 409);
      if (action !== "replace") return json({ error: "Your payment is still processing. Please refresh payment status before retrying." }, 409);
      const { data: nextKey, error: rotateError } = await admin.rpc("rotate_yoco_checkout_attempt", {
        p_order_id: order.id, p_token: lease.token, p_previous_checkout: order.payment_checkout_id,
      });
      if (rotateError || !nextKey) throw new Error(rotateError?.message || "Could not reserve payment retry");
      idempotencyKey = String(nextKey);
    }

    const reference = `MFULA-${order.order_number}`;
    const returnUrl = `${origin}/payment/result?order=${order.order_number}&order_id=${order.id}`;

    const checkout = await createYocoCheckout({
      amountRands: total,
      currency: "ZAR",
      successUrl: `${returnUrl}&payment_status=COMPLETE`,
      cancelUrl: `${returnUrl}&payment_status=CANCELLED`,
      failureUrl: `${returnUrl}&payment_status=FAILED`,
      metadata: {
        order_id: order.id,
        order_number: String(order.order_number),
        reference,
        user_id: user.id,
      },
      idempotencyKey: `order-${mode}-${order.id}-${idempotencyKey}`,
      mode,
    });

    if (!checkout?.redirectUrl) {
      return json({ error: "Yoco did not return a checkout URL. Please try again." }, 502);
    }

    const { error: saveError } = await admin.rpc("finish_yoco_checkout", {
      p_order_id: order.id, p_token: lease.token, p_checkout_id: checkout.id,
      p_reference: reference, p_mode: mode, p_amount: total,
    });
    if (saveError) throw new Error(saveError.message);

    return json({
      checkout_id: checkout.id,
      redirect_url: checkout.redirectUrl,
      order_number: order.order_number,
      total,
      reference,
      test_mode: isTestMode(mode),
      payment_mode: mode,
    });
  } catch (err) {
    console.error("yoco-create-checkout error", err);
    return json(
      { error: err instanceof Error ? err.message : "Could not start payment." },
      500,
    );
  } finally {
    if (lease) await admin.from("yoco_checkout_attempts").update({ lease_token: null, lease_until: null })
      .eq("order_id", lease.orderId).eq("lease_token", lease.token);
  }
});
