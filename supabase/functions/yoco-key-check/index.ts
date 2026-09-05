// Diagnostic: verifies the configured YOCO_SECRET_KEY by creating a minimal
// R100 checkout exactly like the Yoco API example, then reports the result.
// Admin-only: requires a valid user JWT with the admin role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { createYocoCheckout, isTestMode } from "../_shared/yoco.ts";

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

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    const keyPrefix = (Deno.env.get("YOCO_SECRET_KEY") ?? "").slice(0, 7);

    const checkout = await createYocoCheckout({
      amountRands: 100,
      currency: "ZAR",
      successUrl: "https://mfuladeliveries.online/payment/result",
      cancelUrl: "https://mfuladeliveries.online/payment/result",
      failureUrl: "https://mfuladeliveries.online/payment/result",
      metadata: { diagnostic: "key-check" },
      idempotencyKey: `key-check-${user.id}`,
    });

    // Probe the refund endpoint too. The checkout above is unpaid, so Yoco
    // should reject the refund — an auth/permission error here would instead
    // mean the key cannot use the refunds API at all.
    let refundProbe: Record<string, unknown> = { skipped: true };
    try {
      const res = await fetch(
        `https://payments.yoco.com/api/checkouts/${encodeURIComponent(checkout.id)}/refund`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("YOCO_SECRET_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ amount: 10000 }),
        },
      );
      const text = await res.text();
      let parsed: Record<string, unknown> = {};
      try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
      refundProbe = { http_status: res.status, response: parsed };
    } catch (e) {
      refundProbe = { error: e instanceof Error ? e.message : String(e) };
    }

    return json({
      ok: true,
      key_prefix: keyPrefix,
      test_mode: isTestMode(),
      checkout_id: checkout.id,
      status: checkout.status ?? null,
      redirect_url: checkout.redirectUrl ?? null,
      refund_probe: refundProbe,
    });
  } catch (err) {
    console.error("yoco-key-check error", err);
    return json(
      {
        ok: false,
        key_prefix: (Deno.env.get("YOCO_SECRET_KEY") ?? "").slice(0, 7) || null,
        test_mode: isTestMode(),
        error: err instanceof Error ? err.message : "Checkout creation failed",
      },
      500,
    );
  }
});
