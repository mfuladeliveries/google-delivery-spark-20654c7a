// Shared Yoco Online Payments helpers.
//
// Yoco Checkout API docs: https://developer.yoco.com/api-reference/checkout-api
// All calls MUST happen server-side — the secret key never touches the browser.
//
// Two completely separate environments are supported:
//   live -> YOCO_SECRET_KEY      (sk_live_...) + YOCO_WEBHOOK_SECRET
//   test -> YOCO_TEST_SECRET_KEY (sk_test_...) + YOCO_TEST_WEBHOOK_SECRET
// The mode is chosen per order and never mixes credentials: test mode refuses
// to run unless a real sk_test key is configured.

export const YOCO_API_BASE = "https://payments.yoco.com/api";

export type PaymentMode = "live" | "test";

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

export function normalizeMode(value: unknown): PaymentMode {
  return String(value ?? "").toLowerCase() === "test" ? "test" : "live";
}

/** The admin-selected payment mode (app_settings.payment_mode). Defaults to live. */
// deno-lint-ignore no-explicit-any
export async function getPaymentMode(supabase: any): Promise<PaymentMode> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "payment_mode")
      .maybeSingle();
    const value = (data?.value ?? {}) as { mode?: string };
    return normalizeMode(value.mode);
  } catch (e) {
    console.warn("yoco: could not read payment_mode, defaulting to live", e);
    return "live";
  }
}

/** true when a usable Yoco test key is configured. */
export function testKeyConfigured(): boolean {
  return (Deno.env.get("YOCO_TEST_SECRET_KEY") ?? "").startsWith("sk_test");
}

function secretKey(mode: PaymentMode): string {
  if (mode === "test") {
    const key = Deno.env.get("YOCO_TEST_SECRET_KEY") ?? "";
    if (!key) {
      throw new Error(
        "Test payment mode is on but no Yoco test key is configured (YOCO_TEST_SECRET_KEY).",
      );
    }
    // Hard guard: never let test mode fall back to live credentials.
    if (!key.startsWith("sk_test")) {
      throw new Error(
        "YOCO_TEST_SECRET_KEY is not a Yoco test key (sk_test_...). Refusing to run test payments with live credentials.",
      );
    }
    return key;
  }
  const key = Deno.env.get("YOCO_SECRET_KEY");
  if (!key) throw new Error("YOCO_SECRET_KEY is not configured");
  return key;
}

/** true when the request will not move real money. */
export function isTestMode(mode: PaymentMode = "live"): boolean {
  if (mode === "test") return true;
  return (Deno.env.get("YOCO_SECRET_KEY") ?? "").startsWith("sk_test");
}

export function keyPrefix(mode: PaymentMode = "live"): string {
  const raw = mode === "test"
    ? (Deno.env.get("YOCO_TEST_SECRET_KEY") ?? "")
    : (Deno.env.get("YOCO_SECRET_KEY") ?? "");
  return raw.slice(0, 8);
}

export function randsToCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}

export function centsToRands(cents: number | null | undefined): number {
  return Math.round(Number(cents ?? 0)) / 100;
}

async function yocoFetch(
  path: string,
  mode: PaymentMode,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const { idempotencyKey, ...rest } = init;
  const res = await fetch(`${YOCO_API_BASE}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${secretKey(mode)}`,
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
  mode?: PaymentMode;
}): Promise<YocoCheckout> {
  const mode = params.mode ?? "live";
  const { ok, status, body } = await yocoFetch("/checkouts", mode, {
    method: "POST",
    idempotencyKey: params.idempotencyKey,
    body: JSON.stringify({
      amount: randsToCents(params.amountRands),
      currency: params.currency ?? "ZAR",
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      failureUrl: params.failureUrl,
      metadata: { ...params.metadata, payment_mode: mode },
    }),
  });

  if (!ok) {
    console.error("Yoco createCheckout failed", { mode, status, body });
    throw new Error(
      (body?.message as string) || (body?.description as string) ||
        `Yoco checkout creation failed (${status})`,
    );
  }
  return body as YocoCheckout;
}

/** Authoritative server-side read of a checkout's state. */
export async function getYocoCheckout(
  checkoutId: string,
  mode: PaymentMode = "live",
): Promise<YocoCheckout | null> {
  const { ok, status, body } = await yocoFetch(
    `/checkouts/${encodeURIComponent(checkoutId)}`,
    mode,
    { method: "GET" },
  );
  if (!ok) {
    console.warn("Yoco getCheckout failed", { checkoutId, mode, status, body });
    return null;
  }
  return body as YocoCheckout;
}

/** Refund a checkout in full (omit amount) or partially (amount in rands). */
export async function refundYocoCheckout(
  checkoutId: string,
  amountRands?: number,
  idempotencyKey?: string,
  mode: PaymentMode = "live",
): Promise<Record<string, unknown>> {
  const { ok, status, body } = await yocoFetch(
    `/checkouts/${encodeURIComponent(checkoutId)}/refund`,
    mode,
    {
      method: "POST",
      idempotencyKey,
      body: JSON.stringify(
        typeof amountRands === "number" ? { amount: randsToCents(amountRands) } : {},
      ),
    },
  );
  if (!ok) {
    console.error("Yoco refund failed", { checkoutId, mode, status, body });
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
 *
 * Both the live and the test webhook secret are tried, so test-mode webhooks
 * are accepted without ever weakening live verification. The matching secret
 * tells us which environment the event came from.
 */
export async function verifyYocoWebhook(
  headers: Headers,
  rawBody: string,
  toleranceSeconds = 300,
): Promise<{ valid: boolean; reason?: string; mode?: PaymentMode }> {
  const candidates: Array<{ mode: PaymentMode; secret: string }> = [];
  const liveSecret = Deno.env.get("YOCO_WEBHOOK_SECRET");
  const testSecret = Deno.env.get("YOCO_TEST_WEBHOOK_SECRET");
  if (liveSecret) candidates.push({ mode: "live", secret: liveSecret });
  if (testSecret) candidates.push({ mode: "test", secret: testSecret });
  if (candidates.length === 0) {
    return { valid: false, reason: "YOCO_WEBHOOK_SECRET not configured" };
  }

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

  const provided = signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice(3));

  const signed = new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`);

  for (const candidate of candidates) {
    const rawSecret = candidate.secret.startsWith("whsec_")
      ? candidate.secret.slice("whsec_".length)
      : candidate.secret;
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
    const mac = await crypto.subtle.sign("HMAC", key, signed);
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
    if (provided.some((c) => constantTimeEquals(c, expected))) {
      return { valid: true, mode: candidate.mode };
    }
  }

  return { valid: false, reason: "signature mismatch" };
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
  mode?: PaymentMode;
}): Promise<ConfirmResult | null> {
  const mode = args.mode ?? "live";
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
    p_raw_payload: { ...args.payload, payment_mode: mode },
    p_source_ip: args.sourceIp ?? null,
  });

  if (error) {
    console.error("yoco: confirm_online_payment failed", error);
    throw new Error(error.message ?? "Failed to confirm payment");
  }
  return data as ConfirmResult;
}
