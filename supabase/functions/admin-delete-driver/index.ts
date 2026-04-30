import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) throw new Error("Not authorized");

    const { user_id, mode } = await req.json();
    if (!user_id) throw new Error("Missing user_id");

    // Block removal if driver has an active delivery
    const { data: activeOrders } = await adminClient
      .from("orders")
      .select("id")
      .eq("driver_id", user_id)
      .in("status", ["driver_assigned", "picking_up", "arrived_at_restaurant", "out_for_delivery"])
      .limit(1);
    if (activeOrders && activeOrders.length > 0) {
      throw new Error("Driver has an active delivery. Reassign or wait for it to finish.");
    }

    if (mode === "revoke") {
      // Just remove the driver role; keep account & history
      await adminClient.from("user_roles").delete().eq("user_id", user_id).eq("role", "driver");
      await adminClient.from("driver_profiles").update({ is_online: false }).eq("user_id", user_id);
    } else {
      // Full delete — remove auth user (cascades not relied on; clean profile rows first)
      await adminClient.from("driver_profiles").delete().eq("user_id", user_id);
      await adminClient.from("user_roles").delete().eq("user_id", user_id).eq("role", "driver");
      const { error: delErr } = await adminClient.auth.admin.deleteUser(user_id);
      if (delErr) throw delErr;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
