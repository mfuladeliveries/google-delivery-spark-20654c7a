// Admin-only Yoco refund. Full refund by default, partial when `amount` is sent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { isTestMode, refundYocoCheckout } from "../_shared/yoco.ts";

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

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    const body = (await req.json().catch(() => ({}))) as {
      order_id?: string;
      amount?: number;
    };
    const orderId = (body.order_id ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "Invalid order_id" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: order } = await admin
      .from("orders")
      .select("id, total, payment_status, payment_checkout_id, payment_provider_txn_id")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return json({ error: "Order not found" }, 404);
    if (order.payment_status === "refunded") {
      return json({ already_refunded: true });
    }
    if (order.payment_status !== "paid") {
      return json({ error: "This order has no captured online payment to refund." }, 409);
    }
    if (!order.payment_checkout_id) {
      return json({ error: "No Yoco checkout reference stored for this order." }, 409);
    }

    const amount = typeof body.amount === "number" ? Number(body.amount) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0 || amount > Number(order.total))) {
      return json({ error: "Invalid refund amount" }, 400);
    }

    if (isTestMode()) {
      console.warn("yoco-refund: running against Yoco test keys — refunds may be unsupported");
    }

    const result = await refundYocoCheckout(
      order.payment_checkout_id,
      amount,
      `refund-${order.id}-${amount ?? "full"}`,
    );

    const status = String(result.status ?? "").toLowerCase();
    if (status === "succeeded" || status === "success") {
      const { error } = await admin.rpc("mark_online_payment_refunded", {
        p_order_id: order.id,
        p_provider: "yoco",
        p_payment_id: (result.refundId as string) ?? order.payment_provider_txn_id,
        p_amount: amount ?? Number(order.total),
        p_raw_payload: result,
      });
      if (error) console.error("yoco-refund: mark refunded failed", error);
    }

    return json({ ok: true, status: status || "pending", refund: result });
  } catch (err) {
    console.error("yoco-refund error", err);
    return json({ error: err instanceof Error ? err.message : "Refund failed" }, 500);
  }
});
