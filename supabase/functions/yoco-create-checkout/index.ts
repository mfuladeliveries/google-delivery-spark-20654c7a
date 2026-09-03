// Creates a Yoco hosted checkout for an order the caller owns.
// The amount is always taken from the DB order total — never from the client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { createYocoCheckout, getYocoCheckout, isTestMode } from "../_shared/yoco.ts";

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
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    const body = (await req.json().catch(() => ({}))) as {
      order_id?: string;
      return_origin?: string;
    };
    const orderId = (body.order_id ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "Invalid order_id" }, 400);

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

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select(
        "id, user_id, order_number, total, status, payment_status, restaurant, payment_checkout_id",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) return json({ error: "Order not found" }, 404);
    if (order.user_id !== user.id) return json({ error: "Not your order" }, 403);
    if (order.payment_status === "paid") {
      return json({ already_paid: true, order_number: order.order_number });
    }
    if (order.status !== "pending_payment") {
      return json({ error: "This order is not awaiting payment." }, 409);
    }

    const total = Number(order.total);
    if (!Number.isFinite(total) || total <= 0) return json({ error: "Invalid order total" }, 400);

    // Reuse an existing checkout when it is still usable (browser back / retry).
    if (order.payment_checkout_id) {
      const existing = await getYocoCheckout(order.payment_checkout_id);
      const status = String(existing?.status ?? "").toLowerCase();
      if (existing?.redirectUrl && (status === "created" || status === "started")) {
        return json({
          checkout_id: existing.id,
          redirect_url: existing.redirectUrl,
          order_number: order.order_number,
          total,
          test_mode: isTestMode(),
          reused: true,
        });
      }
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
      idempotencyKey: `order-${order.id}-${Math.round(total * 100)}`,
    });

    if (!checkout?.redirectUrl) {
      return json({ error: "Yoco did not return a checkout URL. Please try again." }, 502);
    }

    await admin
      .from("orders")
      .update({
        payment_provider: "yoco",
        payment_checkout_id: checkout.id,
        payment_reference: reference,
        payment_amount: total,
        payment_currency: "ZAR",
        payment_status: "pending",
        payment_initiated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return json({
      checkout_id: checkout.id,
      redirect_url: checkout.redirectUrl,
      order_number: order.order_number,
      total,
      reference,
      test_mode: isTestMode(),
    });
  } catch (err) {
    console.error("yoco-create-checkout error", err);
    return json(
      { error: err instanceof Error ? err.message : "Could not start payment." },
      500,
    );
  }
});
