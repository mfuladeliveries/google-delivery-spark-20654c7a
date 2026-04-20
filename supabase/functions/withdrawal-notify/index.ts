import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Payload {
  event: "requested" | "approved" | "paid" | "rejected";
  request_id: string;
  driver_id?: string;
  amount: number;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: must be signed in
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    const body = (await req.json()) as Payload;
    if (!body?.event || !body?.request_id || typeof body.amount !== "number") {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller has rights for this event
    // - 'requested' → must be the driver themself
    // - 'approved' | 'paid' | 'rejected' → must be admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const isAdmin = !!roles?.some((r: any) => r.role === "admin");

    // Fetch request for accurate driver_id
    const { data: reqRow } = await supabase
      .from("withdrawal_requests")
      .select("id, driver_id, amount, status")
      .eq("id", body.request_id)
      .single();
    if (!reqRow) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.event === "requested" && callerId !== reqRow.driver_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.event !== "requested" && !isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // VAPID keys
    const { data: vapidData } = await supabase
      .from("push_config")
      .select("key, value")
      .in("key", ["vapid_public_key", "vapid_private_key"]);
    if (!vapidData || vapidData.length < 2) {
      return new Response(JSON.stringify({ sent: 0, note: "VAPID not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const publicKey = vapidData.find((d) => d.key === "vapid_public_key")!.value;
    const privateKey = vapidData.find((d) => d.key === "vapid_private_key")!.value;
    webpush.setVapidDetails("mailto:noreply@mfula.app", publicKey, privateKey);

    const amountFmt = `R${Number(body.amount).toFixed(2)}`;
    const targets: { userId: string; title: string; body: string; url: string }[] = [];

    if (body.event === "requested") {
      // Notify all admins
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      for (const a of admins || []) {
        targets.push({
          userId: a.user_id,
          title: "🏦 New Withdrawal Request",
          body: `${amountFmt} from a driver. Review in the admin panel.`,
          url: "/admin",
        });
      }
    } else {
      // Notify the driver
      const driverTitles: Record<string, { title: string; body: string }> = {
        approved: {
          title: "✅ Withdrawal Approved",
          body: `${amountFmt} approved. Payout is being processed.`,
        },
        paid: {
          title: "💰 Payout Sent",
          body: `${amountFmt} has been paid to your bank account.`,
        },
        rejected: {
          title: "❌ Withdrawal Rejected",
          body: body.reason ? `${amountFmt} rejected: ${body.reason}` : `${amountFmt} was rejected.`,
        },
      };
      const meta = driverTitles[body.event];
      if (meta) {
        targets.push({
          userId: reqRow.driver_id,
          title: meta.title,
          body: meta.body,
          url: "/driver",
        });
      }
    }

    if (targets.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get subscriptions
    const userIds = [...new Set(targets.map((t) => t.userId))];
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    let sent = 0;
    const expired: string[] = [];

    for (const sub of subs || []) {
      const target = targets.find((t) => t.userId === sub.user_id);
      if (!target) continue;
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: target.title,
            body: target.body,
            icon: "/pwa-192x192.png",
            badge: "/favicon.ico",
            data: { url: target.url },
          })
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
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
