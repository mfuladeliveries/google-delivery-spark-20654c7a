// PayFast Instant Transaction Notification (ITN) handler.
// 1. Parse application/x-www-form-urlencoded body from PayFast
// 2. Verify the MD5 signature using our passphrase
// 3. (Optional) check the source IP against PayFast's published list
// 4. POST the payload back to PayFast for server-to-server validation
// 5. Update the order via SECURITY DEFINER RPCs
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { buildPayfastSignature } from "../_shared/payfast-signature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PASSPHRASE = Deno.env.get("PAYFAST_PASSPHRASE") ?? "";
const MODE = (Deno.env.get("PAYFAST_MODE") ?? "sandbox").toLowerCase();
const VALIDATE_URL =
  MODE === "live"
    ? "https://www.payfast.co.za/eng/query/validate"
    : "https://sandbox.payfast.co.za/eng/query/validate";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // PayFast expects a 200 OK response. We log everything but never throw to
  // the network layer — return 200 even on internal failure so PayFast does
  // not retry forever; failures are visible in payment_transactions table.
  let rawBody = "";
  try {
    rawBody = await req.text();
    const params = new URLSearchParams(rawBody);
    const fields: Record<string, string> = {};
    for (const [k, v] of params.entries()) fields[k] = v;

    const sourceIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "";

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const orderId = fields.m_payment_id;
    const providerTxnId = fields.pf_payment_id || "";
    const paymentStatus = (fields.payment_status || "").toUpperCase();

    if (!orderId) {
      console.error("ITN: missing m_payment_id");
      return new Response("OK", { status: 200 });
    }

    // 1. Signature check
    const expectedSig = await buildPayfastSignature(fields, PASSPHRASE);
    const sigOk =
      typeof fields.signature === "string" &&
      fields.signature.toLowerCase() === expectedSig.toLowerCase();

    if (!sigOk) {
      console.warn("ITN: signature mismatch", {
        orderId,
        got: fields.signature,
        expected: expectedSig,
      });
      // Still log so admins can see attempted fraud
      await supabase.from("payment_transactions").insert({
        order_id: orderId,
        provider: "payfast",
        provider_txn_id: providerTxnId,
        payment_status: "INVALID_SIGNATURE",
        raw_payload: fields,
        signature_valid: false,
        source_ip: sourceIp,
      });
      return new Response("OK", { status: 200 });
    }

    // 2. Server-to-server validation (skip in sandbox if needed; included for safety)
    try {
      const validateRes = await fetch(VALIDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: rawBody,
      });
      const validateText = (await validateRes.text()).trim();
      if (validateText !== "VALID") {
        console.warn("ITN: PayFast validate did not return VALID", {
          orderId,
          response: validateText,
        });
        await supabase.from("payment_transactions").insert({
          order_id: orderId,
          provider: "payfast",
          provider_txn_id: providerTxnId,
          payment_status: "VALIDATION_FAILED",
          raw_payload: fields,
          signature_valid: true,
          source_ip: sourceIp,
        });
        return new Response("OK", { status: 200 });
      }
    } catch (e) {
      console.warn("ITN: validate call failed (continuing on signature only)", e);
    }

    // 3. Apply to DB
    if (paymentStatus === "COMPLETE") {
      const amountGross = Number(fields.amount_gross || 0);
      const amountFee = Number(fields.amount_fee || 0);
      const amountNet = Number(fields.amount_net || 0);
      const paymentMethod = fields.payment_method || "";

      const { data, error } = await supabase.rpc("confirm_payfast_payment", {
        p_order_id: orderId,
        p_provider_txn_id: providerTxnId,
        p_amount_gross: amountGross,
        p_amount_fee: amountFee,
        p_amount_net: amountNet,
        p_payment_method: paymentMethod,
        p_raw_payload: fields,
        p_source_ip: sourceIp,
      });

      if (error) {
        console.error("ITN: confirm_payfast_payment failed", error);
        return new Response("OK", { status: 200 });
      }

      const result = data as {
        order_id: string;
        order_number: number;
        restaurant: string;
        total: number;
        user_id: string;
        newly_paid: boolean;
      };

      // Only kick off dispatch + notifications on the first transition
      if (result?.newly_paid) {
        // Notify customer
        try {
          await supabase.functions.invoke("push-notify", {
            body: {
              order_id: result.order_id,
              order_number: result.order_number,
              status: "payment_received",
              restaurant: result.restaurant,
              total: result.total,
              target_user_id: result.user_id,
            },
          });
        } catch (e) {
          console.warn("ITN: customer push failed", e);
        }

        // Kick off the targeted dispatch chain
        try {
          const { data: dispatchRes } = await supabase.rpc(
            "dispatch_assign_next",
            { p_order_id: result.order_id },
          );
          const d = dispatchRes as
            | { phase?: string; offered_to?: string | null }
            | null;
          if (d?.offered_to && (d.phase === "offer_a" || d.phase === "offer_b")) {
            await supabase.functions.invoke("push-notify", {
              body: {
                order_id: result.order_id,
                order_number: result.order_number,
                status: "offer_pending",
                restaurant: result.restaurant,
                total: result.total,
                target_user_id: d.offered_to,
              },
            });
          } else if (d?.phase === "waiting") {
            await supabase.functions.invoke("push-notify", {
              body: {
                order_id: result.order_id,
                order_number: result.order_number,
                status: "dispatch_broadcast",
                restaurant: result.restaurant,
                total: result.total,
              },
            });
          }
        } catch (e) {
          console.warn("ITN: dispatch failed", e);
        }
      }
    } else if (
      paymentStatus === "FAILED" ||
      paymentStatus === "CANCELLED"
    ) {
      const { error } = await supabase.rpc("mark_payfast_payment_failed", {
        p_order_id: orderId,
        p_provider_txn_id: providerTxnId,
        p_status: paymentStatus,
        p_reason: fields.reason_code || paymentStatus,
        p_raw_payload: fields,
        p_source_ip: sourceIp,
      });
      if (error) console.error("ITN: mark failed RPC error", error);
    } else {
      // PENDING or other — just log
      await supabase.from("payment_transactions").insert({
        order_id: orderId,
        provider: "payfast",
        provider_txn_id: providerTxnId,
        payment_status: paymentStatus || "UNKNOWN",
        amount_gross: Number(fields.amount_gross || 0) || null,
        raw_payload: fields,
        signature_valid: true,
        source_ip: sourceIp,
      });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("ITN handler error:", err, { rawBody });
    return new Response("OK", { status: 200 });
  }
});
