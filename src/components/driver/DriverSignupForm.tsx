import { useState, ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Mail,
  Lock,
  User,
  Phone,
  IdCard,
  Bike,
  Hash,
  FileText,
  Camera,
  Eye,
  EyeOff,
} from "lucide-react";

interface Props {
  onSubmitted: (email: string) => void; // called after signup so parent can show OTP screen
}

const VEHICLE_TYPES = ["Motorbike", "Scooter", "Bicycle", "Car", "Bakkie / Van"];

interface FormState {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  idNumber: string;
  vehicleType: string;
  vehicleReg: string;
  licenseFile: File | null;
  photoFile: File | null;
}

const initialForm: FormState = {
  fullName: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
  idNumber: "",
  vehicleType: "Motorbike",
  vehicleReg: "",
  licenseFile: null,
  photoFile: null,
};

const inputBase =
  "w-full rounded-xl border border-border bg-background pl-10 pr-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--driver-info))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--driver-info)/0.2)]";

const DriverSignupForm = ({ onSubmitted }: Props) => {
  const [form, setForm] = useState<FormState>(initialForm);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onFile = (k: "licenseFile" | "photoFile") => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > 5 * 1024 * 1024) {
      setError(`${k === "photoFile" ? "Profile photo" : "Driver's licence"} must be under 5 MB`);
      return;
    }
    setError("");
    set(k, f);
  };

  const uploadDoc = async (userId: string, file: File, label: string) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${userId}/${label}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("driver-documents")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return path; // store the storage path; admin generates signed URLs
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate
    if (form.password.length < 6) return setError("Password must be at least 6 characters");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match");
    if (!form.fullName.trim()) return setError("Full name is required");
    if (!form.phone.trim()) return setError("Phone number is required");
    if (!form.idNumber.trim()) return setError("ID number is required");
    if (!form.vehicleReg.trim()) return setError("Vehicle registration is required");
    if (!form.licenseFile) return setError("Please upload your driver's licence");
    if (!form.photoFile) return setError("Please upload a profile photo");

    setBusy(true);

    // 1. Create the auth user
    const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/driver/login`,
        data: { full_name: form.fullName.trim() },
      },
    });
    if (signUpErr || !signUp.user) {
      setBusy(false);
      return setError(signUpErr?.message || "Could not create account");
    }

    const userId = signUp.user.id;

    try {
      // 2. Upload docs (driver-documents is private; RLS scopes to {user_id}/...)
      const licensePath = await uploadDoc(userId, form.licenseFile!, "license");
      const photoPath = await uploadDoc(userId, form.photoFile!, "photo");

      // 3. Save profile (full name + contact)
      await supabase.from("profiles").upsert(
        {
          user_id: userId,
          full_name: form.fullName.trim(),
          contact_number: form.phone.trim(),
        },
        { onConflict: "user_id" },
      );

      // 4. Save driver profile (will exist after the trigger runs on driver role
      //    being granted, but we upsert proactively so docs are saved now).
      await supabase.from("driver_profiles").upsert(
        {
          user_id: userId,
          vehicle_type: form.vehicleType,
          license_plate: form.vehicleReg.trim(),
          id_number: form.idNumber.trim(),
          license_url: licensePath,
          profile_photo_url: photoPath,
          // id_document and license docs both live under driver-documents/{userId}
          id_document_url: licensePath, // legacy column; safe placeholder
        },
        { onConflict: "user_id" },
      );

      // 5. Create the access request so admin can review
      const message = [
        `Vehicle: ${form.vehicleType} (${form.vehicleReg})`,
        `ID: ${form.idNumber}`,
        `Phone: ${form.phone}`,
      ].join(" • ");
      await supabase.from("driver_access_requests").insert({
        user_id: userId,
        message,
      });

      onSubmitted(form.email.trim());
    } catch (err: any) {
      setError(err?.message || "Could not save your details. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            required
            placeholder="Full name (as on ID)"
            className={inputBase}
          />
        </div>
        <div className="relative">
          <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            required
            inputMode="tel"
            placeholder="Phone number"
            className={inputBase}
          />
        </div>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            required
            placeholder="Email"
            className={inputBase}
          />
        </div>
        <div className="relative">
          <IdCard className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={form.idNumber}
            onChange={(e) => set("idNumber", e.target.value)}
            required
            placeholder="ID number"
            className={inputBase}
          />
        </div>
        <div className="relative">
          <Bike className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={form.vehicleType}
            onChange={(e) => set("vehicleType", e.target.value)}
            className={inputBase}
          >
            {VEHICLE_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Hash className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={form.vehicleReg}
            onChange={(e) => set("vehicleReg", e.target.value)}
            required
            placeholder="Vehicle registration"
            className={inputBase}
          />
        </div>

        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <FileText className="h-3.5 w-3.5" /> Driver's licence (image or PDF)
          </span>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={onFile("licenseFile")}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-[hsl(var(--driver-info))] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
          />
          {form.licenseFile && (
            <p className="mt-1 text-[11px] text-muted-foreground truncate">
              {form.licenseFile.name}
            </p>
          )}
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Camera className="h-3.5 w-3.5" /> Profile photo
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={onFile("photoFile")}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-[hsl(var(--driver-info))] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
          />
          {form.photoFile && (
            <p className="mt-1 text-[11px] text-muted-foreground truncate">{form.photoFile.name}</p>
          )}
        </label>

        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type={showPwd ? "text" : "password"}
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            required
            minLength={6}
            placeholder="Password (min 6 chars)"
            className={inputBase}
          />
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type={showPwd ? "text" : "password"}
            value={form.confirmPassword}
            onChange={(e) => set("confirmPassword", e.target.value)}
            required
            minLength={6}
            placeholder="Confirm password"
            className={inputBase}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-[hsl(var(--driver-info))] py-3.5 font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Create driver account"}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">
        After signup, an admin must approve your account before you can start delivering.
      </p>
    </form>
  );
};

export default DriverSignupForm;
