// Returns the current status + payment_status for an order, scoped to the
// authenticated user. Used by the order confirmation page to poll while the
// PayFast ITN webhook finalises payment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth client — resolves the calling user from the JWT.
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userRes, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = userRes.user.id;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const orderId: string | undefined =
      typeof body.orderId === "string" ? body.orderId : undefined;
    const orderNumberRaw = body.orderNumber;
    const orderNumber =
      typeof orderNumberRaw === "number"
        ? orderNumberRaw
        : typeof orderNumberRaw === "string" && orderNumberRaw.trim() !== ""
        ? Number(orderNumberRaw)
        : undefined;

    if (!orderId && (orderNumber === undefined || !Number.isFinite(orderNumber))) {
      return json({ error: "orderId or orderNumber is required" }, 400);
    }

    // Use the same auth-scoped client so RLS ("Users can view own orders")
    // enforces ownership — we never leak another user's order.
    let query = authClient
      .from("orders")
      .select(
        "id, order_number, status, payment_status, payment_method, total, restaurant, delivery_code"
      )
      .eq("user_id", userId)
      .limit(1);

    query = orderId
      ? query.eq("id", orderId)
      : query.eq("order_number", orderNumber as number);

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error("get-order-status query error:", error);
      return json({ error: "Failed to fetch order status" }, 500);
    }
    if (!data) {
      return json({ error: "Order not found" }, 404);
    }

    return json({
      id: data.id,
      order_number: data.order_number,
      status: data.status,
      payment_status: data.payment_status,
      payment_method: data.payment_method,
      total: data.total,
      restaurant: data.restaurant,
      delivery_code: data.delivery_code,
    });
  } catch (err) {
    console.error("get-order-status fatal:", err);
    return json({ error: "Unexpected error" }, 500);
  }
});
