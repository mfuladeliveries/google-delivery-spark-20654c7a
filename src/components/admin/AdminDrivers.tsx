import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Truck, Pause, Play, FileText, Camera } from "lucide-react";

interface DriverRow {
  user_id: string;
  vehicle_type: string | null;
  license_plate: string | null;
  id_number: string | null;
  is_online: boolean;
  is_suspended: boolean;
  suspended_reason: string | null;
  license_url: string | null;
  profile_photo_url: string | null;
  full_name?: string;
  contact_number?: string;
}

const AdminDrivers = () => {
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: drivers } = await supabase
      .from("driver_profiles")
      .select(
        "user_id, vehicle_type, license_plate, id_number, is_online, is_suspended, suspended_reason, license_url, profile_photo_url",
      )
      .order("updated_at", { ascending: false });
    const ids = (drivers || []).map((d) => d.user_id);
    const { data: profiles } = ids.length
      ? await supabase
          .from("profiles")
          .select("user_id, full_name, contact_number")
          .in("user_id", ids)
      : { data: [] as { user_id: string; full_name: string; contact_number: string }[] };
    const map = new Map(
      (profiles || []).map((p) => [p.user_id, p] as const),
    );
    setRows(
      (drivers || []).map((d) => ({
        ...d,
        full_name: map.get(d.user_id)?.full_name,
        contact_number: map.get(d.user_id)?.contact_number,
      })) as DriverRow[],
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleSuspend = async (row: DriverRow) => {
    const next = !row.is_suspended;
    let reason: string | null = null;
    if (next) {
      reason = window.prompt("Reason for suspending this driver?", "") ?? null;
      if (reason === null) return; // user cancelled
    }
    setBusyId(row.user_id);
    const { error } = await supabase.rpc("admin_set_driver_suspended", {
      p_user_id: row.user_id,
      p_suspended: next,
      p_reason: reason,
    });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(next ? "Driver suspended" : "Driver reinstated");
    load();
  };

  const openDoc = async (path: string | null) => {
    if (!path) return toast.error("No document on file");
    const { data, error } = await supabase.storage
      .from("driver-documents")
      .createSignedUrl(path, 60 * 5);
    if (error || !data) return toast.error(error?.message || "Could not open document");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
        <Truck className="h-4 w-4 text-primary" /> Drivers ({rows.length})
      </h2>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No driver profiles yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => (
            <div key={d.user_id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-foreground truncate">
                    {d.full_name || "Unnamed driver"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {d.vehicle_type || "—"} • {d.license_plate || "no reg"}
                  </p>
                  {d.contact_number && (
                    <p className="text-xs text-muted-foreground">📞 {d.contact_number}</p>
                  )}
                  {d.id_number && (
                    <p className="text-[10px] text-muted-foreground">ID: {d.id_number}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      d.is_suspended
                        ? "bg-red-100 text-red-700"
                        : d.is_online
                          ? "bg-green-100 text-green-700"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {d.is_suspended ? "suspended" : d.is_online ? "online" : "offline"}
                  </span>
                </div>
              </div>

              {d.suspended_reason && (
                <p className="mb-2 text-xs text-destructive">⚠ {d.suspended_reason}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => openDoc(d.license_url)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  <FileText className="h-3.5 w-3.5" /> Licence
                </button>
                <button
                  onClick={() => openDoc(d.profile_photo_url)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  <Camera className="h-3.5 w-3.5" /> Photo
                </button>
                <button
                  onClick={() => toggleSuspend(d)}
                  disabled={busyId === d.user_id}
                  className={`ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50 ${
                    d.is_suspended ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:opacity-90"
                  }`}
                >
                  {d.is_suspended ? (
                    <>
                      <Play className="h-3.5 w-3.5" /> Reinstate
                    </>
                  ) : (
                    <>
                      <Pause className="h-3.5 w-3.5" /> Suspend
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDrivers;
