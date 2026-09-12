// Yoco webhook receiver — the authoritative source of payment truth.
// 1. Verify the Standard Webhooks HMAC-SHA256 signature
// 2. De-duplicate by webhook event id (payment_webhook_events)
// 3. Re-read the checkout from Yoco and apply the result via SECURITY DEFINER RPCs
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import {
  centsToRands,
  confirmPaidOrder,
  getYocoCheckout,
  runPostPaymentSideEffects,
  verifyYocoWebhook,
} from "../_shared/yoco.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Records a webhook failure so admins can see it in real time instead of it
// dying in a console log. Never throws — logging must not break the handler.
// deno-lint-ignore no-explicit-any
async function logFailure(
  supabase: any,
  entry: {
    stage: string;
    event_id?: string | null;
    event_type?: string | null;
    order_id?: string | null;
    order_number?: number | null;
    error_message?: string | null;
    payload?: Record<string, unknown> | null;
    source_ip?: string | null;
  },
) {
  try {
    await supabase.from("yoco_webhook_failures").insert({
      stage: entry.stage,
      event_id: entry.event_id ?? null,
      event_type: entry.event_type ?? null,
      order_id: entry.order_id ?? null,
      order_number: entry.order_number ?? null,
      error_message: entry.error_message ?? null,
      payload: entry.payload ?? null,
      source_ip: entry.source_ip ?? null,
    });
  } catch (e) {
    console.error("yoco-webhook: failure logging failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const verification = await verifyYocoWebhook(req.headers, rawBody);
  if (!verification.valid) {
    console.warn("yoco-webhook: rejected", verification.reason);
    let bodySnippet: Record<string, unknown> | null = null;
    try {
      bodySnippet = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      bodySnippet = { raw: rawBody.slice(0, 2000) };
    }
    await logFailure(supabase, {
      stage: "signature_rejected",
      event_id: req.headers.get("webhook-id"),
      error_message: verification.reason ?? "Invalid signature",
      payload: bodySnippet,
    });
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sourceIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || null;

  try {
    const event = JSON.parse(rawBody) as {
      id?: string;
      type?: string;
      createdDate?: string;
      payload?: Record<string, unknown>;
    };

    const eventId = event.id ?? req.headers.get("webhook-id") ?? "";
    const eventType = String(event.type ?? "");
    const payload = (event.payload ?? {}) as Record<string, unknown>;

    const metadata = (payload.metadata ?? {}) as Record<string, string>;
    const checkoutId = String(payload.checkoutId ?? payload.checkout_id ?? "") || null;
    const paymentId = String(payload.id ?? payload.paymentId ?? "") || null;

    // Resolve the order: metadata first, then checkout id, then payment id.
    let orderId = metadata.order_id ?? null;
    if (!orderId && (checkoutId || paymentId)) {
      const { data: found } = await supabase
        .from("orders")
        .select("id")
        .or(
          [
            checkoutId ? `payment_checkout_id.eq.${checkoutId}` : null,
            paymentId ? `payment_provider_txn_id.eq.${paymentId}` : null,
          ].filter(Boolean).join(","),
        )
        .maybeSingle();
      orderId = found?.id ?? null;
    }

    // Idempotency: a repeated delivery must never re-trigger dispatch/notifications.
    const { error: dupErr } = await supabase.from("payment_webhook_events").insert({
      provider: "yoco",
      event_id: eventId || `${eventType}-${paymentId ?? checkoutId ?? crypto.randomUUID()}`,
      event_type: eventType,
      order_id: orderId,
      payload: event as unknown as Record<string, unknown>,
    });
    if (dupErr) {
      if (dupErr.code === "23505" || /duplicate key/i.test(dupErr.message ?? "")) {
        console.log("yoco-webhook: duplicate event ignored", eventId);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("yoco-webhook: ledger insert failed", dupErr);
      await logFailure(supabase, {
        stage: "ledger_insert_failed",
        event_id: eventId || null,
        event_type: eventType,
        order_id: orderId,
        error_message: dupErr.message,
        payload: event as unknown as Record<string, unknown>,
        source_ip: sourceIp,
      });
    }

    if (!orderId) {
      console.warn("yoco-webhook: could not resolve order", { eventType, checkoutId, paymentId });
      await logFailure(supabase, {
        stage: "order_unresolved",
        event_id: eventId || null,
        event_type: eventType,
        error_message: `No order matched checkout ${checkoutId ?? "—"} / payment ${paymentId ?? "—"}`,
        payload: event as unknown as Record<string, unknown>,
        source_ip: sourceIp,
      });
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eventType === "payment.succeeded") {
      // Re-read from Yoco so a spoofed/incorrect amount can never be trusted.
      const checkout = checkoutId ? await getYocoCheckout(checkoutId) : null;
      const amountCents = Number(
        checkout?.amount ?? payload.amount ?? 0,
      );
      const result = await confirmPaidOrder(supabase, {
        orderId,
        paymentId,
        checkoutId,
        reference: metadata.reference ?? null,
        amountGross: centsToRands(amountCents),
        amountFee: null,
        amountNet: null,
        paymentMethod: String(payload.paymentMethodDetails ?? payload.mode ?? "card"),
        currency: String(checkout?.currency ?? payload.currency ?? "ZAR"),
        payload: event as unknown as Record<string, unknown>,
        sourceIp,
      });
      if (result) await runPostPaymentSideEffects(supabase, result);
    } else if (eventType === "refund.succeeded") {
      const amountCents = Number(payload.amount ?? 0);
      const { error } = await supabase.rpc("mark_online_payment_refunded", {
        p_order_id: orderId,
        p_provider: "yoco",
        p_payment_id: paymentId,
        p_amount: amountCents ? centsToRands(amountCents) : null,
        p_raw_payload: event as unknown as Record<string, unknown>,
      });
      if (error) {
        console.error("yoco-webhook: refund RPC failed", error);
        await logFailure(supabase, {
          stage: "refund_confirmation_failed",
          event_id: eventId || null,
          event_type: eventType,
          order_id: orderId,
          error_message: error.message,
          payload: event as unknown as Record<string, unknown>,
          source_ip: sourceIp,
        });
      }
    } else if (
      eventType === "payment.failed" || eventType === "payment.cancelled" ||
      eventType === "checkout.failed"
    ) {
      const { error } = await supabase.rpc("mark_online_payment_failed", {
        p_order_id: orderId,
        p_provider: "yoco",
        p_payment_id: paymentId,
        p_status: eventType.endsWith("cancelled") ? "cancelled" : "failed",
        p_reason: String(payload.failureReason ?? payload.reason ?? eventType),
        p_raw_payload: event as unknown as Record<string, unknown>,
        p_source_ip: sourceIp,
      });
      if (error) {
        console.error("yoco-webhook: fail RPC error", error);
        await logFailure(supabase, {
          stage: "failure_mark_failed",
          event_id: eventId || null,
          event_type: eventType,
          order_id: orderId,
          error_message: error.message,
          payload: event as unknown as Record<string, unknown>,
          source_ip: sourceIp,
        });
      }
    } else {
      console.log("yoco-webhook: unhandled event type", eventType);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("yoco-webhook handler error", err);
    let bodySnippet: Record<string, unknown> | null = null;
    try {
      bodySnippet = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      bodySnippet = { raw: rawBody.slice(0, 2000) };
    }
    await logFailure(supabase, {
      stage: "handler_error",
      event_id: req.headers.get("webhook-id"),
      event_type: bodySnippet?.type ? String(bodySnippet.type) : null,
      error_message: err instanceof Error ? err.message : "Unknown handler error",
      payload: bodySnippet,
      source_ip: sourceIp,
    });
    // 500 lets Yoco retry — the ledger keeps retries idempotent.
    return new Response(JSON.stringify({ error: "Handler error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
