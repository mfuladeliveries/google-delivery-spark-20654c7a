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
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) throw new Error("Not authorized");

    const { email, password, full_name, contact_number, role, vehicle_type, license_plate, restaurant_id, invite } = await req.json();

    if (!email || !role) throw new Error("Missing required fields");
    const useInvite = invite === true || !password;
    if (!useInvite && !password) throw new Error("Password required");

    // Create user — either via invite email (sets own password) or directly with password
    let userId: string | null = null;
    let invitedEmailSent = false;
    let createErr: any = null;
    let newUser: any = null;

    if (useInvite) {
      const origin = req.headers.get("origin") || req.headers.get("referer") || undefined;
      const redirectTo = origin ? `${origin}/reset-password` : undefined;
      const res = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name },
        redirectTo,
      });
      newUser = res.data;
      createErr = res.error;
      invitedEmailSent = !createErr;
    } else {
      const res = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      newUser = res.data;
      createErr = res.error;
    }

    if (createErr) {
      // If the email is already registered, look up the existing user and reuse them.
      const msg = (createErr.message || "").toLowerCase();
      const alreadyExists =
        msg.includes("already been registered") ||
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("duplicate");

      if (!alreadyExists) throw createErr;

      // Find the existing user by email (paginate just in case)
      let found: { id: string } | null = null;
      for (let page = 1; page <= 20 && !found; page++) {
        const { data: list, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
        if (listErr) throw listErr;
        const match = list.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
        if (match) found = { id: match.id };
        if (list.users.length < 200) break;
      }
      if (!found) throw new Error("Email already registered but user could not be located");
      userId = found.id;

      // Reset password to the value the admin just entered so they can hand it off.
      await adminClient.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
    } else {
      userId = newUser.user.id;
    }

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
