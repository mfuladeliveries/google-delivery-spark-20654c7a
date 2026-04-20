// Triggered by the client AFTER a user has inserted a driver_access_request row.
// Sends a web-push notification to all admins so they can review the request.
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

    // Authenticate caller — must be a signed-in user
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

    const userId = claimsData.claims.sub as string;
    const userEmail = (claimsData.claims.email as string) || "a user";

    const body = await req.json().catch(() => ({}));
    const requestId: string | undefined = body?.request_id;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get VAPID keys (push is best-effort — we still return ok if unset)
    const { data: vapidData } = await supabase
      .from("push_config")
      .select("key, value")
      .in("key", ["vapid_public_key", "vapid_private_key"]);

    if (!vapidData || vapidData.length < 2) {
      return new Response(JSON.stringify({ sent: 0, note: "vapid_not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const publicKey = vapidData.find((d) => d.key === "vapid_public_key")!.value;
    const privateKey = vapidData.find((d) => d.key === "vapid_private_key")!.value;
    webpush.setVapidDetails("mailto:noreply@mfula.app", publicKey, privateKey);

    // Find all admin user_ids
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (admins || []).map((a) => a.user_id).filter((id) => id !== userId);

    if (adminIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", adminIds);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: "🚖 New driver access request",
      body: `${userEmail} wants driver access. Tap to review.`,
      icon: "/pwa-192x192.png",
      badge: "/favicon.ico",
      tag: `driver-request-${requestId || userId}`,
      data: { url: "/admin", kind: "driver_access_request" },
    });

    let sent = 0;
    const expired: string[] = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
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
