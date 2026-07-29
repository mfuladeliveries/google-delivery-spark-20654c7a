// PayFast: build a signed payment payload for a pending_payment order.
// The frontend POSTs the order_id; we look up the order, verify it belongs
// to the caller, then return the form fields + the PayFast process URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { buildPayfastSignature } from "../_shared/payfast-signature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MERCHANT_ID = Deno.env.get("PAYFAST_MERCHANT_ID") ?? "";
const MERCHANT_KEY = Deno.env.get("PAYFAST_MERCHANT_KEY") ?? "";
const PASSPHRASE = Deno.env.get("PAYFAST_PASSPHRASE") ?? "";
const MODE = (Deno.env.get("PAYFAST_MODE") ?? "sandbox").toLowerCase();

const PROCESS_URL =
  MODE === "live"
    ? "https://www.payfast.co.za/eng/process"
    : "https://sandbox.payfast.co.za/eng/process";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!MERCHANT_ID || !MERCHANT_KEY) {
      throw new Error("PayFast credentials not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userRes.user.id;
    const userEmail = userRes.user.email || "";

    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id ?? "").trim();
    const returnOrigin = String(body.return_origin ?? "").trim();
    // Optional PayFast payment_method hint. Whitelist to known codes so we don't
    // forward arbitrary client input. 'cc' = card, 'ef' = Instant EFT.
    const ALLOWED_METHODS = new Set(["cc", "ef", "dc", "mp", "mc", "sc", "ss", "zp"]);
    const rawMethod = String(body.payment_method ?? "").trim().toLowerCase();
    const paymentMethodHint = ALLOWED_METHODS.has(rawMethod) ? rawMethod : "";
    if (!orderId) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select(
        "id, order_number, total, customer_name, customer_contact, status, user_id, restaurant",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.status !== "pending_payment") {
      return new Response(
        JSON.stringify({
          error: "Order is not awaiting payment",
          status: order.status,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // PayFast amount must be 2dp string.
    const amount = Number(order.total).toFixed(2);
    const [firstName, ...rest] = String(order.customer_name || "Customer")
      .trim()
      .split(/\s+/);
    const lastName = rest.join(" ") || firstName;

    // Origin for return/cancel — fall back to project-published domain.
    const origin =
      returnOrigin && /^https?:\/\//.test(returnOrigin)
        ? returnOrigin.replace(/\/$/, "")
        : "https://google-delivery-spark.lovable.app";

    const itnUrl = `${SUPABASE_URL}/functions/v1/payfast-itn`;

    // Field order matters for the signature — use PayFast's documented order.
    const fields: Record<string, string> = {
      merchant_id: MERCHANT_ID,
      merchant_key: MERCHANT_KEY,
      return_url: `${origin}/payment/result?payment_status=COMPLETE&order=${order.order_number}&m_payment_id=${order.id}&amount_gross=${amount}&item_name=${encodeURIComponent(`Mfula Order #${order.order_number}`)}`,
      cancel_url: `${origin}/payment/result?payment_status=CANCELLED&order=${order.order_number}&m_payment_id=${order.id}&amount_gross=${amount}&item_name=${encodeURIComponent(`Mfula Order #${order.order_number}`)}`,
      notify_url: itnUrl,
      name_first: firstName.slice(0, 100),
      name_last: lastName.slice(0, 100),
      // In sandbox, PayFast rejects the handoff when the buyer email belongs to
      // the merchant sandbox account. Leave it blank so the tester can enter a
      // separate sandbox buyer account on the hosted checkout page.
      email_address: MODE === "sandbox" ? "" : userEmail.slice(0, 255),
      cell_number: String(order.customer_contact || "")
        .replace(/[^\d]/g, "")
        .slice(0, 15),
      m_payment_id: order.id, // our order UUID — comes back in ITN
      amount,
      item_name: `Mfula Order #${order.order_number}`.slice(0, 100),
      item_description: `Order from ${order.restaurant}`.slice(0, 255),
      custom_str1: String(order.order_number),
      // Pre-select card or EFT on PayFast's hosted checkout when the customer chose one.
      payment_method: paymentMethodHint,
    };

    // Drop empty optional fields before signing.
    for (const k of Object.keys(fields)) {
      if (!fields[k]) delete fields[k];
    }

    const signature = await buildPayfastSignature(fields, PASSPHRASE);
    fields.signature = signature;

    console.log("payfast-create-payment ok", {
      mode: MODE,
      process_url: PROCESS_URL,
      order_number: order.order_number,
      fields: Object.keys(fields),
    });


    return new Response(
      JSON.stringify({
        process_url: PROCESS_URL,
        fields,
        mode: MODE,
        order_number: order.order_number,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("payfast-create-payment error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
