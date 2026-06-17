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
  driver_assigned: "Driver accepted your order",
  picking_up: "Driver is heading to the restaurant",
  arrived_at_restaurant: "Driver has arrived at the restaurant",
  out_for_delivery: "Your food is on the way",
  delivered: "Your order has arrived",
  cancelled: "Order Cancelled",
  rejected: "Order Rejected",
};

const statusEmojis: Record<string, string> = {
  pending: "🕐",
  confirmed: "✅",
  preparing: "👨‍🍳",
  ready: "📦",
  driver_assigned: "🧑‍✈️",
  picking_up: "🚗",
  arrived_at_restaurant: "🏪",
  out_for_delivery: "🍔",
  delivered: "🎉",
  cancelled: "❌",
  rejected: "🚫",
};

// Mirror of src/lib/zones.ts — keep in sync.
const zoneInfoForFee = (deliveryFee: number | null | undefined): { zone: 1 | 2 | null; payout: number } => {
  const fee = Number(deliveryFee ?? 0);
  if (fee >= 75) return { zone: 2, payout: 55 };
  if (fee >= 65) return { zone: 1, payout: 45 };
  return { zone: null, payout: Math.round(fee * 0.7) };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate caller — only signed-in users OR the service role (used by other edge functions) may trigger pushes
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    // Allow service-role calls (from other edge functions like dispatch-tick) to skip user-claim verification
    const isServiceRole = token === serviceRoleKey;
    let callerUserId: string | null = null;
    if (!isServiceRole) {
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
      callerUserId = claimsData.claims.sub as string;
    }

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
    const {
      order_id,
      order_number,
      status,
      restaurant,
      total,
      user_id,
      driver_id,
      restaurant_id,
      old_status,
      reason,
      refund_amount,
      target_user_id, // NEW: explicit recipient for dispatch events
    } = event;

    // Authorization: when called by a real user (not service-role / not another edge function),
    // require that the caller is a participant in the referenced order. This prevents arbitrary
    // users from sending fake offers, broadcasts, or cancellations to other users.
    if (!isServiceRole && callerUserId) {
      if (!order_id) {
        return new Response(JSON.stringify({ error: "order_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: ord } = await supabase
        .from("orders")
        .select("user_id, customer_id, driver_id, restaurant_id")
        .eq("id", order_id)
        .maybeSingle();
      if (!ord) {
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", callerUserId)
        .in("role", ["admin"])
        .maybeSingle();
      const isAdmin = !!roleRow;
      let isParticipant =
        ord.user_id === callerUserId ||
        ord.customer_id === callerUserId ||
        ord.driver_id === callerUserId;
      if (!isParticipant && ord.restaurant_id) {
        const { data: rest } = await supabase
          .from("restaurants")
          .select("owner_user_id")
          .eq("id", ord.restaurant_id)
          .maybeSingle();
        if (rest?.owner_user_id === callerUserId) isParticipant = true;
      }
      if (!isAdmin && !isParticipant) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    const emoji = statusEmojis[status] || "📋";
    const label = statusLabels[status] || status;
    const isDriverCancelUnavailable = status === "cancelled" && reason === "item_unavailable";
    const isCancelWithReason = status === "cancelled" && reason && !isDriverCancelUnavailable;
    const isBankRefundPaid = status === "bank_refund_paid";

    // Dispatch events
    const isOfferPending = status === "offer_pending";
    const isOfferMissed = status === "offer_missed";
    const isDispatchBroadcast = status === "dispatch_broadcast";
    const isNoDriverAvailable = status === "no_driver_available";
    const isNoDriverFound = status === "no_driver_found";
    const isNoDriverFoundRestaurant = status === "no_driver_found_restaurant";


    // Detect refund-choice cancellations
    let refundChoiceAmount: number | null = null;
    if ((status === "cancelled" || status === "rejected") && order_id) {
      const { data: ord } = await supabase
        .from("orders")
        .select("payment_method, refund_status, refund_amount")
        .eq("id", order_id)
        .maybeSingle();
      if (ord?.payment_method === "online" && ord?.refund_status === "pending") {
        refundChoiceAmount = Number(ord.refund_amount) || 0;
      }
    }
    const isRefundChoice = refundChoiceAmount !== null;

    // Look up the order's delivery_fee so we can show the driver the zone + payout
    let orderDeliveryFee: number | null = null;
    const isDriverFacingDispatch = isOfferPending || isOfferMissed || isDispatchBroadcast;
    if (isDriverFacingDispatch && order_id) {
      const { data: ord } = await supabase
        .from("orders")
        .select("delivery_fee")
        .eq("id", order_id)
        .maybeSingle();
      if (ord) orderDeliveryFee = Number(ord.delivery_fee ?? 0);
    }
    const { zone: zoneId, payout: driverPayout } = zoneInfoForFee(orderDeliveryFee);
    const zoneSuffix = zoneId ? ` · Zone ${zoneId} · R${driverPayout} payout` : "";

    const targetUserIds: string[] = [];

    // Dispatch: targeted push to a specific driver
    if ((isOfferPending || isOfferMissed) && target_user_id) {
      targetUserIds.push(target_user_id);
    }

    // Dispatch broadcast: all online drivers + all admins
    if (isDispatchBroadcast) {
      const [{ data: drivers }, { data: admins }] = await Promise.all([
        supabase.from("driver_profiles").select("user_id").eq("is_online", true),
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
      ]);
      (drivers || []).forEach((d) => targetUserIds.push(d.user_id));
      (admins || []).forEach((a) => {
        if (!targetUserIds.includes(a.user_id)) targetUserIds.push(a.user_id);
      });
    }

    // Original flows
    if (status === "pending" && !old_status) {
      if (restaurant_id) {
        const { data: rest } = await supabase
          .from("restaurants")
          .select("owner_user_id")
          .eq("id", restaurant_id)
          .single();
        if (rest?.owner_user_id) targetUserIds.push(rest.owner_user_id);
      }
    }

    // Customer status updates (excludes new dispatch events)
    if (
      [
        "confirmed",
        "preparing",
        "ready",
        "driver_assigned",
        "picking_up",
        "arrived_at_restaurant",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "rejected",
        "bank_refund_paid",
      ].includes(status) &&
      user_id
    ) {
      if (!targetUserIds.includes(user_id)) {
        targetUserIds.push(user_id);
      }
    }

    // No-driver-available: notify the customer (resolve user_id from order if needed)
    let noDriverCustomerId: string | null = null;
    if (isNoDriverAvailable) {
      noDriverCustomerId = user_id || null;
      if (!noDriverCustomerId && order_id) {
        const { data: ord } = await supabase
          .from("orders")
          .select("user_id")
          .eq("id", order_id)
          .maybeSingle();
        noDriverCustomerId = ord?.user_id || null;
      }
      if (noDriverCustomerId && !targetUserIds.includes(noDriverCustomerId)) {
        targetUserIds.push(noDriverCustomerId);
      }
    }


    // No-driver-FOUND (15min timeout escalation): notify ALL admins + the customer
    const noDriverFoundAdmins = new Set<string>();
    let noDriverFoundCustomerId: string | null = null;
    if (isNoDriverFound) {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      (admins || []).forEach((a) => {
        noDriverFoundAdmins.add(a.user_id);
        if (!targetUserIds.includes(a.user_id)) targetUserIds.push(a.user_id);
      });

      noDriverFoundCustomerId = user_id || null;
      if (!noDriverFoundCustomerId && order_id) {
        const { data: ord } = await supabase
          .from("orders")
          .select("user_id")
          .eq("id", order_id)
          .maybeSingle();
        noDriverFoundCustomerId = ord?.user_id || null;
      }
      if (noDriverFoundCustomerId && !targetUserIds.includes(noDriverFoundCustomerId)) {
        targetUserIds.push(noDriverFoundCustomerId);
      }

    }

    // No-driver-FOUND restaurant alert: targeted push to the restaurant owner
    if (isNoDriverFoundRestaurant && target_user_id) {
      if (!targetUserIds.includes(target_user_id)) targetUserIds.push(target_user_id);
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reasonSuffix = isCancelWithReason ? ` Reason: ${reason}` : "";

    // Build payloads per audience
    const customerPayload = JSON.stringify({
      title: isBankRefundPaid
        ? `💸 Refund sent for #${order_number}`
        : isRefundChoice
          ? `💰 Choose your refund for #${order_number}`
          : isDriverCancelUnavailable || isCancelWithReason
            ? `❌ Order #${order_number} Cancelled`
            : `${emoji} Order #${order_number}`,
      body: isBankRefundPaid
        ? `Your refund${refund_amount ? ` of R${Number(refund_amount).toFixed(2)}` : ""} has been sent. It may take 3–5 business days to reflect in your bank account.`
        : isRefundChoice
          ? `Your order was cancelled.${reasonSuffix} Tap to choose: instant wallet credit (R${refundChoiceAmount!.toFixed(2)}) or bank refund in 3–5 days.`
          : isDriverCancelUnavailable
            ? `Sorry, your order was cancelled because the item is not available at ${restaurant || "the restaurant"}. You won't be charged.`
            : isCancelWithReason
              ? `Your order was cancelled. Reason: ${reason}`
              : label,
      icon: "/notification-logo.png",
      badge: "/favicon.ico",
      data: { url: "/orders", order_number },
    });

    const driverBroadcastPayload = JSON.stringify({
      title: "🚗 New Delivery Available",
      body: `Order #${order_number} ready at ${restaurant}${zoneSuffix}`,
      icon: "/notification-logo.png",
      badge: "/favicon.ico",
      data: { url: "/driver", order_number, zone: zoneId, payout: driverPayout },
    });

    const restaurantPayload = JSON.stringify({
      title: "🔔 New Order Received",
      body: `Order #${order_number} — R${total}`,
      icon: "/notification-logo.png",
      badge: "/favicon.ico",
      data: { url: "/restaurant/dashboard", order_number },
    });

    const offerPendingPayload = JSON.stringify({
      title: "🔔 New Order Offer",
      body: `Order #${order_number} from ${restaurant}${zoneSuffix} — Tap to accept (20s)`,
      icon: "/notification-logo.png",
      badge: "/favicon.ico",
      tag: `offer-${order_number}`,
      data: { url: "/driver", order_number, kind: "offer", zone: zoneId, payout: driverPayout },
    });

    const offerMissedPayload = JSON.stringify({
      title: "⏱️ Missed Order",
      body: `You didn't respond to Order #${order_number}${zoneSuffix ? ` (${zoneSuffix.replace(/^ · /, "")})` : ""} in time. It's been offered to another driver.`,
      icon: "/notification-logo.png",
      badge: "/favicon.ico",
      tag: `missed-${order_number}`,
      data: { url: "/driver", order_number, kind: "missed", zone: zoneId, payout: driverPayout },
    });

    const adminBroadcastPayload = JSON.stringify({
      title: "🚨 Order Needs a Driver",
      body: `Order #${order_number} couldn't be assigned — now broadcast to all drivers.`,
      icon: "/notification-logo.png",
      badge: "/favicon.ico",
      tag: `escalation-${order_number}`,
      data: { url: "/admin", order_number, kind: "escalation" },
    });

    const noDriverPayload = JSON.stringify({
      title: `🛵 No driver available yet for #${order_number}`,
      body: `We couldn't find a driver in your area right now. We'll keep trying and notify you as soon as one accepts.`,
      icon: "/notification-logo.png",
      badge: "/favicon.ico",
      tag: `no-driver-${order_number}`,
      data: { url: "/orders", order_number, kind: "no_driver_available" },
    });

    const noDriverFoundAdminPayload = JSON.stringify({
      title: `🚨 No Driver for #${order_number}`,
      body: `Order #${order_number} from ${restaurant || "restaurant"} has no driver after 15 minutes — please assign manually.`,
      icon: "/notification-logo.png",
      badge: "/favicon.ico",
      tag: `no-driver-found-${order_number}`,
      data: { url: "/admin", order_number, kind: "no_driver_found" },
    });

    const noDriverFoundRestaurantPayload = JSON.stringify({
      title: `🍽️ Driver Search Ongoing — #${order_number}`,
      body: `Order #${order_number} is having trouble finding a driver. Please keep the food ready — we're working on it.`,
      icon: "/notification-logo.png",
      badge: "/favicon.ico",
      tag: `no-driver-found-rest-${order_number}`,
      data: { url: "/restaurant/dashboard", order_number, kind: "no_driver_found_restaurant" },
    });

    const noDriverFoundCustomerPayload = JSON.stringify({
      title: `🛵 Trouble finding a driver for #${order_number}`,
      body: `We're having trouble finding a driver for your order. Our team has been alerted and will resolve this shortly.`,
      icon: "/notification-logo.png",
      badge: "/favicon.ico",
      tag: `no-driver-found-${order_number}`,
      data: { url: "/orders", order_number, kind: "no_driver_found" },
    });


    let sent = 0;
    const expired: string[] = [];

    // Restaurant owner lookup (for "pending" new-order flow)
    let restaurantOwnerId: string | null = null;
    if (status === "pending" && !old_status && restaurant_id) {
      const { data: rest } = await supabase
        .from("restaurants")
        .select("owner_user_id")
        .eq("id", restaurant_id)
        .single();
      restaurantOwnerId = rest?.owner_user_id || null;
    }

    // Admin user IDs (for broadcast escalation)
    const adminUserIds = new Set<string>();
    if (isDispatchBroadcast) {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      (admins || []).forEach((a) => adminUserIds.add(a.user_id));
    }

    // Dedupe key for one-shot customer notifications (cancel / out_for_delivery)
    // Maps the event to a stable "kind" string per (order, user).
    const dedupeKind: string | null =
      status === "cancelled" || status === "rejected"
        ? "customer_cancelled"
        : status === "out_for_delivery"
          ? "customer_out_for_delivery"
          : isNoDriverAvailable
            ? "customer_no_driver_available"
            : isNoDriverFound
              ? "customer_no_driver_found"
              : null;


    // Driver-facing notification kinds — logged against the order's customer so the
    // customer's Orders page can render a "driver was notified" status log.
    const driverKind: string | null = isOfferPending
      ? "driver_offer_pending"
      : isOfferMissed
        ? "driver_offer_missed"
        : isDispatchBroadcast
          ? "driver_dispatch_broadcast"
          : null;

    // Resolve the customer user_id for driver-kind logging (when we only got order_id)
    let customerUserId: string | null = user_id || null;
    if (driverKind && !customerUserId && order_id) {
      const { data: ord } = await supabase
        .from("orders")
        .select("user_id")
        .eq("id", order_id)
        .maybeSingle();
      customerUserId = ord?.user_id || null;
    }

    for (const sub of subs) {
      try {
        let payload = customerPayload;
        let isCustomerOneShot = false;

        if (isOfferPending && sub.user_id === target_user_id) {
          payload = offerPendingPayload;
        } else if (isOfferMissed && sub.user_id === target_user_id) {
          payload = offerMissedPayload;
        } else if (isDispatchBroadcast) {
          payload = adminUserIds.has(sub.user_id) ? adminBroadcastPayload : driverBroadcastPayload;
        } else if (isNoDriverAvailable && sub.user_id === noDriverCustomerId) {
          payload = noDriverPayload;
          isCustomerOneShot = true;
        } else if (isNoDriverFound) {
          if (noDriverFoundAdmins.has(sub.user_id)) {
            payload = noDriverFoundAdminPayload;
          } else if (sub.user_id === noDriverFoundCustomerId) {
            payload = noDriverFoundCustomerPayload;
            isCustomerOneShot = true;
          } else {
            continue;
          }
        } else if (sub.user_id === restaurantOwnerId) {
          payload = restaurantPayload;
        } else if (dedupeKind && order_id && sub.user_id === user_id) {
          // Only dedupe the customer-facing one-shot events
          isCustomerOneShot = true;
        }



        // Skip duplicate one-shot customer notifications
        if (isCustomerOneShot) {
          const { error: insertErr } = await supabase
            .from("order_notification_log")
            .insert({
              order_id,
              user_id: sub.user_id,
              notification_kind: dedupeKind,
            });
          // Unique violation = already sent → skip
          if (insertErr) {
            continue;
          }
        }

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

    // Log driver-facing dispatch events once per (order, kind) against the customer
    // so the Orders page can render a per-order driver-notification status log.
    if (driverKind && order_id && customerUserId && sent > 0) {
      await supabase
        .from("order_notification_log")
        .insert({
          order_id,
          user_id: customerUserId,
          notification_kind: driverKind,
        })
        .then(() => {}, () => {}); // ignore unique-violation duplicates
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
