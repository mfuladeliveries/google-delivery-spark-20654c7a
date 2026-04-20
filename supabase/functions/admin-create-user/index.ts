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

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) throw new Error("Not authorized");

    const { email, password, full_name, contact_number, role, vehicle_type, license_plate, restaurant_id } = await req.json();

    if (!email || !password || !role) throw new Error("Missing required fields");

    // Create user with admin API (no email confirmation needed)
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr) throw createErr;

    const userId = newUser.user.id;

    // Update profile
    if (full_name || contact_number) {
      await adminClient.from("profiles").update({
        full_name: full_name || "",
        contact_number: contact_number || "",
      }).eq("user_id", userId);
    }

    // Set role (update the default 'customer' role)
    await adminClient.from("user_roles").update({ role }).eq("user_id", userId);

    // Role-specific setup
    if (role === "driver") {
      // Upsert ensures the driver_profile exists even when the role was UPDATEd
      // (the auto-create trigger only fires on INSERT into user_roles).
      await adminClient.from("driver_profiles").upsert({
        user_id: userId,
        vehicle_type: vehicle_type || "",
        license_plate: license_plate || "",
      }, { onConflict: "user_id" });
    }

    if (role === "restaurant" && restaurant_id) {
      await adminClient.from("restaurants").update({ owner_user_id: userId }).eq("id", restaurant_id);
    }

    return new Response(JSON.stringify({ user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
