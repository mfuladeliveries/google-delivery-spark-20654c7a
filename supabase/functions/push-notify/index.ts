import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const statusLabels: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Accepted by Restaurant",
  preparing: "Being Prepared",
  ready: "Ready for Pickup",
  driver_assigned: "Driver Assigned",
  picking_up: "Driver at Restaurant",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Order Cancelled",
  rejected: "Order Rejected",
};

const statusEmojis: Record<string, string> = {
  pending: "🕐",
  confirmed: "✅",
  preparing: "👨‍🍳",
  ready: "📦",
  driver_assigned: "🧑‍✈️",
  picking_up: "🏪",
  out_for_delivery: "🚗",
  delivered: "🎉",
  cancelled: "❌",
  rejected: "🚫",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get VAPID keys
    const { data: vapidData } = await supabase
      .from("push_config")
      .select("key, value")
      .in("key", ["vapid_public_key", "vapid_private_key"]);

    if (!vapidData || vapidData.length < 2) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const publicKey = vapidData.find((d) => d.key === "vapid_public_key")!.value;
    const privateKey = vapidData.find((d) => d.key === "vapid_private_key")!.value;

    webpush.setVapidDetails("mailto:noreply@mfula.app", publicKey, privateKey);

    const event = await req.json();
    const { order_number, status, restaurant, total, user_id, driver_id, restaurant_id, old_status } = event;

    const emoji = statusEmojis[status] || "📋";
    const label = statusLabels[status] || status;

    // Determine who to notify
    const targetUserIds: string[] = [];
    let title = "";
    let body = "";

    if (status === "pending" && !old_status) {
      // New order → notify restaurant owner
      if (restaurant_id) {
        const { data: rest } = await supabase
          .from("restaurants")
          .select("owner_user_id")
          .eq("id", restaurant_id)
          .single();
        if (rest?.owner_user_id) targetUserIds.push(rest.owner_user_id);
      }
      title = "🔔 New Order Received";
      body = `Order #${order_number} — R${total}`;
    } else if (status === "ready" && !driver_id) {
      // Ready for pickup → notify all online drivers
      const { data: drivers } = await supabase
        .from("driver_profiles")
        .select("user_id")
        .eq("is_online", true);
      if (drivers) targetUserIds.push(...drivers.map((d) => d.user_id));
      title = "🚗 New Delivery Available";
      body = `Order #${order_number} ready at ${restaurant}`;
    }

    // Status updates → notify customer
    if (
      [
        "confirmed",
        "preparing",
        "ready",
        "driver_assigned",
        "picking_up",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "rejected",
      ].includes(status) &&
      user_id
    ) {
      if (!targetUserIds.includes(user_id)) {
        targetUserIds.push(user_id);
      }
      if (!title) {
        title = `${emoji} Order #${order_number}`;
        body = label;
      }
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get push subscriptions for target users
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For customer notifications, use the specific title/body
    // For other targets, we might want a different message
    const customerPayload = JSON.stringify({
      title: `${emoji} Order #${order_number}`,
      body: label,
      icon: "/pwa-192x192.png",
      badge: "/favicon.ico",
      data: { url: "/orders", order_number },
    });

    const driverPayload = JSON.stringify({
      title: "🚗 New Delivery Available",
      body: `Order #${order_number} ready at ${restaurant}`,
      icon: "/pwa-192x192.png",
      badge: "/favicon.ico",
      data: { url: "/driver", order_number },
    });

    const restaurantPayload = JSON.stringify({
      title: "🔔 New Order Received",
      body: `Order #${order_number} — R${total}`,
      icon: "/pwa-192x192.png",
      badge: "/favicon.ico",
      data: { url: "/restaurant/dashboard", order_number },
    });

    let sent = 0;
    const expired: string[] = [];

    // Get driver user IDs for driver-specific payload
    const driverUserIds = new Set<string>();
    if (status === "ready" && !driver_id) {
      const { data: drivers } = await supabase
        .from("driver_profiles")
        .select("user_id")
        .eq("is_online", true);
      if (drivers) drivers.forEach((d) => driverUserIds.add(d.user_id));
    }

    // Get restaurant owner ID
    let restaurantOwnerId: string | null = null;
    if (status === "pending" && !old_status && restaurant_id) {
      const { data: rest } = await supabase
        .from("restaurants")
        .select("owner_user_id")
        .eq("id", restaurant_id)
        .single();
      restaurantOwnerId = rest?.owner_user_id || null;
    }

    for (const sub of subs) {
      try {
        let payload = customerPayload;
        if (driverUserIds.has(sub.user_id)) payload = driverPayload;
        if (sub.user_id === restaurantOwnerId) payload = restaurantPayload;

        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          expired.push(sub.id);
        }
      }
    }

    // Clean up expired subscriptions
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
