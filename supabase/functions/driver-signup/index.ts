// Public driver signup completion endpoint.
// The client first calls supabase.auth.signUp() (which sends the OTP email).
// Because email confirmation is required, the new user has NO session yet, so
// all profile/document writes must happen here with the service role.
// Abuse guard: we only write for a user that was created in the last 30 minutes,
// is still unconfirmed, and has no existing driver access request.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const form = await req.formData();
    const userId = String(form.get("user_id") || "");
    const email = String(form.get("email") || "").trim().toLowerCase();
    const fullName = String(form.get("full_name") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const idNumber = String(form.get("id_number") || "").trim();
    const vehicleType = String(form.get("vehicle_type") || "").trim();
    const vehicleReg = String(form.get("vehicle_reg") || "").trim();
    const licenseFile = form.get("license") as File | null;
    const photoFile = form.get("photo") as File | null;

    if (!userId || !email || !fullName || !phone || !idNumber || !vehicleReg) {
      throw new Error("Missing required fields");
    }
    if (!licenseFile || !photoFile) throw new Error("Licence and photo are required");
    if (licenseFile.size > MAX_FILE_BYTES || photoFile.size > MAX_FILE_BYTES) {
      throw new Error("Files must be under 5 MB");
    }

    // Validate the target user: must exist, match the email, be fresh & unconfirmed.
    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
    if (userErr || !userData?.user) throw new Error("Account not found");
    const user = userData.user;
    if ((user.email || "").toLowerCase() !== email) throw new Error("Email mismatch");
    if (user.email_confirmed_at) throw new Error("Account already verified — sign in instead");
    const createdAt = new Date(user.created_at).getTime();
    if (Date.now() - createdAt > 30 * 60 * 1000) {
      throw new Error("Signup session expired — please register again");
    }

    // One driver request per user
    const { data: existing } = await admin
      .from("driver_access_requests")
      .select("id")
      .eq("user_id", userId)
      .limit(1);
    if (existing && existing.length > 0) throw new Error("A driver request already exists for this account");

    // Upload documents (private bucket, path scoped to the user id)
    const upload = async (file: File, label: string) => {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      const path = `${userId}/${label}-${Date.now()}.${ext}`;
      const { error } = await admin.storage
        .from("driver-documents")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      return path;
    };
    const licensePath = await upload(licenseFile, "license");
    const photoPath = await upload(photoFile, "photo");

    // Profile (the auth trigger may already have created the row)
    const { error: profErr } = await admin.from("profiles").upsert(
      { user_id: userId, full_name: fullName, contact_number: phone },
      { onConflict: "user_id" },
    );
    if (profErr) throw profErr;

    // Driver profile with documents
    const { error: dpErr } = await admin.from("driver_profiles").upsert(
      {
        user_id: userId,
        vehicle_type: vehicleType,
        license_plate: vehicleReg,
        id_number: idNumber,
        license_url: licensePath,
        profile_photo_url: photoPath,
        id_document_url: licensePath,
      },
      { onConflict: "user_id" },
    );
    if (dpErr) throw dpErr;

    // Access request for admin review
    const message = [
      `Vehicle: ${vehicleType} (${vehicleReg})`,
      `ID: ${idNumber}`,
      `Phone: ${phone}`,
    ].join(" • ");
    const { error: reqErr } = await admin
      .from("driver_access_requests")
      .insert({ user_id: userId, message });
    if (reqErr) throw reqErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
