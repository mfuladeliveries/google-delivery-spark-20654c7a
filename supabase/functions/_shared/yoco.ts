// Shared Yoco Online Payments helpers.
//
// Yoco Checkout API docs: https://developer.yoco.com/api-reference/checkout-api
// All calls MUST happen server-side — the secret key never touches the browser.

export const YOCO_API_BASE = "https://payments.yoco.com/api";

export interface YocoCheckout {
  id: string;
  status?: string;
  amount?: number;
  currency?: string;
  redirectUrl?: string;
  paymentId?: string | null;
  metadata?: Record<string, string> | null;
  [key: string]: unknown;
}

function secretKey(): string {
  const key = Deno.env.get("YOCO_SECRET_KEY");
  if (!key) throw new Error("YOCO_SECRET_KEY is not configured");
  return key;
}

/** true when the configured key is a Yoco test key (sk_test_...) */
export function isTestMode(): boolean {
  return (Deno.env.get("YOCO_SECRET_KEY") ?? "").startsWith("sk_test");
}

export function randsToCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}

export function centsToRands(cents: number | null | undefined): number {
  return Math.round(Number(cents ?? 0)) / 100;
}

async function yocoFetch(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const { idempotencyKey, ...rest } = init;
  const res = await fetch(`${YOCO_API_BASE}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...(rest.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

/** Create a hosted checkout and return the object containing `redirectUrl`. */
export async function createYocoCheckout(params: {
  amountRands: number;
  currency?: string;
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
  metadata: Record<string, string>;
  idempotencyKey?: string;
}): Promise<YocoCheckout> {
  const { ok, status, body } = await yocoFetch("/checkouts", {
    method: "POST",
    idempotencyKey: params.idempotencyKey,
    body: JSON.stringify({
      amount: randsToCents(params.amountRands),
      currency: params.currency ?? "ZAR",
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      failureUrl: params.failureUrl,
      metadata: params.metadata,
    }),
  });

  if (!ok) {
    console.error("Yoco createCheckout failed", { status, body });
    throw new Error(
      (body?.message as string) || (body?.description as string) ||
        `Yoco checkout creation failed (${status})`,
    );
  }
  return body as YocoCheckout;
}

/** Authoritative server-side read of a checkout's state. */
export async function getYocoCheckout(checkoutId: string): Promise<YocoCheckout | null> {
  const { ok, status, body } = await yocoFetch(
    `/checkouts/${encodeURIComponent(checkoutId)}`,
    { method: "GET" },
  );
  if (!ok) {
    console.warn("Yoco getCheckout failed", { checkoutId, status, body });
    return null;
  }
  return body as YocoCheckout;
}

/** Refund a checkout in full (omit amount) or partially (amount in rands). */
export async function refundYocoCheckout(
  checkoutId: string,
  amountRands?: number,
  idempotencyKey?: string,
): Promise<Record<string, unknown>> {
  const { ok, status, body } = await yocoFetch(
    `/checkouts/${encodeURIComponent(checkoutId)}/refund`,
    {
      method: "POST",
      idempotencyKey,
      body: JSON.stringify(
        typeof amountRands === "number" ? { amount: randsToCents(amountRands) } : {},
      ),
    },
  );
  if (!ok) {
    console.error("Yoco refund failed", { checkoutId, status, body });
    throw new Error(
      (body?.message as string) || (body?.description as string) ||
        `Yoco refund failed (${status})`,
    );
  }
  return body;
}

/**
 * Verify a Yoco webhook using the Standard Webhooks HMAC-SHA256 scheme.
 * signed content = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 */
export async function verifyYocoWebhook(
  headers: Headers,
  rawBody: string,
  toleranceSeconds = 300,
): Promise<{ valid: boolean; reason?: string }> {
  const secret = Deno.env.get("YOCO_WEBHOOK_SECRET");
  if (!secret) return { valid: false, reason: "YOCO_WEBHOOK_SECRET not configured" };

  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) {
    return { valid: false, reason: "missing webhook signature headers" };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { valid: false, reason: "invalid timestamp" };
  const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (skew > toleranceSeconds) return { valid: false, reason: `timestamp skew ${skew}s` };

  const rawSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0));
  } catch {
    keyBytes = new TextEncoder().encode(rawSecret);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`);
  const mac = await crypto.subtle.sign("HMAC", key, signed);
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  const provided = signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice(3));

  const match = provided.some((candidate) => constantTimeEquals(candidate, expected));
  return match ? { valid: true } : { valid: false, reason: "signature mismatch" };
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface ConfirmResult {
  order_id: string;
  order_number: number;
  restaurant: string;
  total: number;
  user_id: string;
  newly_paid: boolean;
  new_status?: string;
  requires_confirmation?: boolean;
}

/**
 * Runs the post-payment side effects exactly once (guarded by `newly_paid`):
 * notify the customer, then either alert the restaurant or start driver dispatch.
 */
// deno-lint-ignore no-explicit-any
export async function runPostPaymentSideEffects(supabase: any, result: ConfirmResult) {
  if (!result?.newly_paid) return;

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
    console.warn("yoco: customer push failed", e);
  }

  if (result.requires_confirmation || result.new_status !== "ready") {
    try {
      await supabase.functions.invoke("push-notify", {
        body: {
          order_id: result.order_id,
          order_number: result.order_number,
          status: "pending",
          restaurant: result.restaurant,
          total: result.total,
        },
      });
    } catch (e) {
      console.warn("yoco: restaurant push failed", e);
    }
    return;
  }

  try {
    const { data: dispatchRes } = await supabase.rpc("dispatch_assign_next", {
      p_order_id: result.order_id,
    });
    const d = dispatchRes as { phase?: string; offered_to?: string | null } | null;
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
    console.warn("yoco: dispatch failed", e);
  }
}

/** Confirm a successful payment against an order (idempotent at the DB level). */
// deno-lint-ignore no-explicit-any
export async function confirmPaidOrder(supabase: any, args: {
  orderId: string;
  paymentId: string | null;
  checkoutId: string | null;
  reference: string | null;
  amountGross: number;
  amountFee?: number | null;
  amountNet?: number | null;
  paymentMethod?: string | null;
  currency?: string | null;
  payload: Record<string, unknown>;
  sourceIp?: string | null;
}): Promise<ConfirmResult | null> {
  const { data, error } = await supabase.rpc("confirm_online_payment", {
    p_order_id: args.orderId,
    p_provider: "yoco",
    p_payment_id: args.paymentId,
    p_checkout_id: args.checkoutId,
    p_reference: args.reference,
    p_amount_gross: args.amountGross,
    p_amount_fee: args.amountFee ?? null,
    p_amount_net: args.amountNet ?? null,
    p_payment_method: args.paymentMethod ?? "card",
    p_currency: args.currency ?? "ZAR",
    p_raw_payload: args.payload,
    p_source_ip: args.sourceIp ?? null,
  });

  if (error) {
    console.error("yoco: confirm_online_payment failed", error);
    throw new Error(error.message ?? "Failed to confirm payment");
  }
  return data as ConfirmResult;
}
