import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const { user_id, email, password, full_name, contact_number } = await req.json();

    if (!user_id) throw new Error("Missing user_id");

    // Update auth credentials
    const updatePayload: Record<string, any> = {};
    if (email) updatePayload.email = email;
    if (password) updatePayload.password = password;

    if (Object.keys(updatePayload).length > 0) {
      const { error: authErr } = await adminClient.auth.admin.updateUserById(user_id, updatePayload);
      if (authErr) throw authErr;
    }

    // Update profile
    const profileUpdate: Record<string, any> = {};
    if (full_name !== undefined) profileUpdate.full_name = full_name;
    if (contact_number !== undefined) profileUpdate.contact_number = contact_number;

    if (Object.keys(profileUpdate).length > 0) {
      await adminClient.from("profiles").update(profileUpdate).eq("user_id", user_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
