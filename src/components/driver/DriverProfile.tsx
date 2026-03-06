import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Camera, Upload, Save, Car, FileText, CreditCard, LogOut, User } from "lucide-react";
import { toast } from "sonner";

interface ProfileData {
  full_name: string;
  contact_number: string;
  address: string;
}

interface DriverProfileData {
  vehicle_type: string;
  license_plate: string;
  license_url: string;
  id_document_url: string;
}

const DriverProfileTab = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({ full_name: "", contact_number: "", address: "" });
  const [driverData, setDriverData] = useState<DriverProfileData>({ vehicle_type: "", license_plate: "", license_url: "", id_document_url: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    const [{ data: p }, { data: d }] = await Promise.all([
      supabase.from("profiles").select("full_name, contact_number, address").eq("user_id", user!.id).maybeSingle(),
      supabase.from("driver_profiles").select("vehicle_type, license_plate, license_url, id_document_url").eq("user_id", user!.id).maybeSingle(),
    ]);
    if (p) setProfile(p);
    if (d) setDriverData(d);
  };

  const handleSave = async () => {
    setSaving(true);
    await Promise.all([
      supabase.from("profiles").update(profile).eq("user_id", user!.id),
      supabase.from("driver_profiles").update({
        vehicle_type: driverData.vehicle_type,
        license_plate: driverData.license_plate,
      }).eq("user_id", user!.id),
    ]);
    toast.success("Profile updated!");
    setSaving(false);
  };

  const handleFileUpload = async (field: "license_url" | "id_document_url", file: File) => {
    if (!user) return;
    setUploading(field);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${field}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("driver-documents").upload(path, file, { upsert: true });
    if (error) {
      toast.error("Upload failed: " + error.message);
      setUploading(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("driver-documents").getPublicUrl(path);
    await supabase.from("driver_profiles").update({ [field]: urlData.publicUrl }).eq("user_id", user.id);
    setDriverData(prev => ({ ...prev, [field]: urlData.publicUrl }));
    toast.success("Document uploaded!");
    setUploading(null);
  };

  return (
    <div className="space-y-4">
      {/* Avatar section */}
      <div className="flex flex-col items-center py-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-3">
          <User className="h-10 w-10 text-primary" />
        </div>
        <p className="font-bold text-foreground text-lg">{profile.full_name || "Driver"}</p>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      {/* Personal Info */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <User className="h-4 w-4 text-primary" /> Personal Info
        </h3>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Full Name</label>
          <input
            value={profile.full_name}
            onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Phone Number</label>
          <input
            value={profile.contact_number}
            onChange={e => setProfile(p => ({ ...p, contact_number: e.target.value }))}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Address</label>
          <input
            value={profile.address}
            onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Vehicle Info */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Car className="h-4 w-4 text-primary" /> Vehicle Info
        </h3>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Vehicle Type</label>
          <select
            value={driverData.vehicle_type}
            onChange={e => setDriverData(d => ({ ...d, vehicle_type: e.target.value }))}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          >
            <option value="">Select vehicle type</option>
            <option value="motorcycle">Motorcycle</option>
            <option value="car">Car</option>
            <option value="bicycle">Bicycle</option>
            <option value="scooter">Scooter</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">License Plate</label>
          <input
            value={driverData.license_plate}
            onChange={e => setDriverData(d => ({ ...d, license_plate: e.target.value }))}
            placeholder="e.g. ABC 123 GP"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Documents */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Documents
        </h3>

        {/* Driver License */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Driver's License</label>
          {driverData.license_url ? (
            <div className="flex items-center gap-2 rounded-xl bg-[hsl(var(--driver-success)/0.08)] border border-[hsl(var(--driver-success)/0.2)] px-4 py-2.5">
              <CreditCard className="h-4 w-4 text-[hsl(var(--driver-success))]" />
              <span className="text-sm text-[hsl(var(--driver-success))] font-medium flex-1">Uploaded ✓</span>
              <label className="text-xs text-primary font-semibold cursor-pointer">
                Replace
                <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => e.target.files?.[0] && handleFileUpload("license_url", e.target.files[0])} />
              </label>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">
                {uploading === "license_url" ? "Uploading..." : "Upload License"}
              </span>
              <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => e.target.files?.[0] && handleFileUpload("license_url", e.target.files[0])} />
            </label>
          )}
        </div>

        {/* ID Document */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">ID Document</label>
          {driverData.id_document_url ? (
            <div className="flex items-center gap-2 rounded-xl bg-[hsl(var(--driver-success)/0.08)] border border-[hsl(var(--driver-success)/0.2)] px-4 py-2.5">
              <FileText className="h-4 w-4 text-[hsl(var(--driver-success))]" />
              <span className="text-sm text-[hsl(var(--driver-success))] font-medium flex-1">Uploaded ✓</span>
              <label className="text-xs text-primary font-semibold cursor-pointer">
                Replace
                <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => e.target.files?.[0] && handleFileUpload("id_document_url", e.target.files[0])} />
              </label>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">
                {uploading === "id_document_url" ? "Uploading..." : "Upload ID Document"}
              </span>
              <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => e.target.files?.[0] && handleFileUpload("id_document_url", e.target.files[0])} />
            </label>
          )}
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-orange flex items-center justify-center gap-2"
      >
        <Save className="h-4 w-4" />
        {saving ? "Saving..." : "Save Profile"}
      </button>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full rounded-2xl border-2 border-destructive/30 bg-destructive/5 py-3.5 text-sm font-bold text-destructive transition-all hover:bg-destructive/10 flex items-center justify-center gap-2"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
    </div>
  );
};

export default DriverProfileTab;
