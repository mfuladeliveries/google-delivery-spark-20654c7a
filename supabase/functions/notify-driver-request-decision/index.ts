// Sends a push notification to the driver applicant when an admin
// approves or rejects their driver_access_request.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Caller must be a signed-in admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestId: string | undefined = body?.request_id;
    const decision: string | undefined = body?.decision; // "approved" | "rejected"
    const notes: string | undefined = body?.notes;

    if (!requestId || (decision !== "approved" && decision !== "rejected")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid request_id / decision" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the applicant
    const { data: reqRow, error: reqErr } = await supabase
      .from("driver_access_requests")
      .select("user_id")
      .eq("id", requestId)
      .maybeSingle();
    if (reqErr || !reqRow?.user_id) {
      return new Response(
        JSON.stringify({ error: "Request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const applicantId = reqRow.user_id;

    // Get VAPID keys
    const { data: vapidData } = await supabase
      .from("push_config")
      .select("key, value")
      .in("key", ["vapid_public_key", "vapid_private_key"]);

    if (!vapidData || vapidData.length < 2) {
      return new Response(
        JSON.stringify({ sent: 0, note: "vapid_not_configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const publicKey = vapidData.find((d) => d.key === "vapid_public_key")!.value;
    const privateKey = vapidData.find((d) => d.key === "vapid_private_key")!.value;
    webpush.setVapidDetails("mailto:noreply@mfula.app", publicKey, privateKey);

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", applicantId);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const noteSuffix = notes && notes.trim().length > 0 ? ` Note: ${notes.trim()}` : "";
    const isApproved = decision === "approved";

    const payload = JSON.stringify({
      title: isApproved
        ? "✅ Driver access approved"
        : "❌ Driver access rejected",
      body: isApproved
        ? `You're now a driver on Mfula Deliveries. Tap to start accepting orders.${noteSuffix}`
        : `Your driver access request was not approved.${noteSuffix}`,
      icon: "/pwa-192x192.png",
      badge: "/favicon.ico",
      tag: `driver-decision-${requestId}`,
      data: {
        url: isApproved ? "/driver" : "/",
        kind: "driver_access_decision",
        decision,
      },
    });

    let sent = 0;
    const expired: string[] = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expired.push(sub.id);
        }
      }
    }

    if (expired.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expired);
    }

    return new Response(JSON.stringify({ sent, expired: expired.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
