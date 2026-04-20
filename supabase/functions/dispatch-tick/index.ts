// Dispatch tick: expires stale offers, advances chain, broadcasts after 5min,
// and triggers push notifications for each transition.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Snapshot before-state so we can compute who-was-offered for "missed" pushes
    const { data: beforeState } = await supabase
      .from("orders")
      .select("id, offered_to_driver_id, dispatch_phase, order_number, restaurant, total")
      .or("dispatch_phase.in.(offer_a,offer_b,waiting)")
      .eq("status", "ready")
      .is("driver_id", null);

    const beforeMap = new Map<string, any>();
    (beforeState || []).forEach((o) => beforeMap.set(o.id, o));

    // Run the tick
    const { data: tickResult, error: tickError } = await supabase.rpc("dispatch_tick");
    if (tickError) {
      console.error("dispatch_tick failed:", tickError);
      return new Response(JSON.stringify({ error: tickError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result: any = tickResult || {};
    const advancedOrderIds: string[] = result.advanced_orders || [];
    const broadcastOrderIds: string[] = result.broadcast_orders || [];

    const pushInvocations: Promise<any>[] = [];

    // For each advanced order: notify the previous offeree (missed) + the new offeree (offer_pending)
    if (advancedOrderIds.length > 0) {
      const { data: afterRows } = await supabase
        .from("orders")
        .select("id, order_number, restaurant, total, offered_to_driver_id, dispatch_phase, user_id")
        .in("id", advancedOrderIds);

      (afterRows || []).forEach((after) => {
        const before = beforeMap.get(after.id);
        const previousDriver = before?.offered_to_driver_id;

        // Notify the driver who missed it
        if (previousDriver) {
          pushInvocations.push(
            supabase.functions.invoke("push-notify", {
              body: {
                order_id: after.id,
                order_number: after.order_number,
                status: "offer_missed",
                restaurant: after.restaurant,
                total: after.total,
                target_user_id: previousDriver,
              },
            })
          );
        }

        // Notify the new offeree (if any)
        if (after.offered_to_driver_id) {
          pushInvocations.push(
            supabase.functions.invoke("push-notify", {
              body: {
                order_id: after.id,
                order_number: after.order_number,
                status: "offer_pending",
                restaurant: after.restaurant,
                total: after.total,
                target_user_id: after.offered_to_driver_id,
              },
            })
          );
        }
      });
    }

    // For each broadcasted order: notify all online drivers + admins
    if (broadcastOrderIds.length > 0) {
      const { data: broadcastRows } = await supabase
        .from("orders")
        .select("id, order_number, restaurant, total")
        .in("id", broadcastOrderIds);

      (broadcastRows || []).forEach((o) => {
        pushInvocations.push(
          supabase.functions.invoke("push-notify", {
            body: {
              order_id: o.id,
              order_number: o.order_number,
              status: "dispatch_broadcast",
              restaurant: o.restaurant,
              total: o.total,
            },
          })
        );
      });
    }

    await Promise.allSettled(pushInvocations);

    return new Response(
      JSON.stringify({
        ok: true,
        advanced: result.advanced || 0,
        broadcasted: result.broadcasted || 0,
        notifications: pushInvocations.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("dispatch-tick fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
