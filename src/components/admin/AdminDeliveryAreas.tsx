import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Plus, Pencil, Trash2, X, Check, Power, PowerOff, Map as MapIcon } from "lucide-react";
import { refreshZones } from "@/lib/serviceArea";

const AddressMapPicker = lazy(() => import("@/components/AddressMapPicker"));

interface DeliveryZone {
  id: string;
  name: string;
  suburb: string;
  lat: number | null;
  lng: number | null;
  radius_km: number;
  delivery_fee: number;
  is_active: boolean;
}

const blankForm = {
  name: "",
  suburb: "",
  lat: "" as string,
  lng: "" as string,
  radius_km: "5",
  delivery_fee: "65",
};

const AdminDeliveryAreas = () => {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const fetchZones = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("delivery_areas")
      .select("id, name, suburb, lat, lng, radius_km, delivery_fee, is_active")
      .order("name");
    if (error) toast.error(error.message);
    else setZones((data || []) as DeliveryZone[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const startCreate = () => {
    setForm(blankForm);
    setEditing(null);
    setCreating(true);
  };

  const startEdit = (z: DeliveryZone) => {
    setForm({
      name: z.name,
      suburb: z.suburb || "",
      lat: z.lat != null ? String(z.lat) : "",
      lng: z.lng != null ? String(z.lng) : "",
      radius_km: String(z.radius_km ?? 5),
      delivery_fee: String(z.delivery_fee ?? 65),
    });
    setEditing(z);
    setCreating(true);
  };

  const cancelEdit = () => {
    setCreating(false);
    setEditing(null);
    setForm(blankForm);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Zone name is required");
      return;
    }
    const lat = form.lat.trim() ? Number(form.lat) : null;
    const lng = form.lng.trim() ? Number(form.lng) : null;
    if (lat != null && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
      toast.error("Latitude must be between -90 and 90");
      return;
    }
    if (lng != null && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
      toast.error("Longitude must be between -180 and 180");
      return;
    }
    const radius = Math.max(0.5, Math.min(50, Number(form.radius_km) || 5));
    const fee = Math.max(0, Number(form.delivery_fee) || 0);

    setSaving(true);
    const payload = {
      name,
      suburb: form.suburb.trim(),
      lat,
      lng,
      radius_km: radius,
      delivery_fee: fee,
    };

    const { error } = editing
      ? await supabase.from("delivery_areas").update(payload).eq("id", editing.id)
      : await supabase.from("delivery_areas").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Zone updated" : "Zone created");
    refreshZones();
    cancelEdit();
    fetchZones();
  };

  const toggleActive = async (z: DeliveryZone) => {
    if (!z.is_active && (z.lat == null || z.lng == null)) {
      toast.error("Set a centre point before activating this zone");
      return;
    }
    const { error } = await supabase
      .from("delivery_areas")
      .update({ is_active: !z.is_active })
      .eq("id", z.id);
    if (error) toast.error(error.message);
    else {
      toast.success(z.is_active ? "Zone deactivated" : "Zone activated");
      refreshZones();
      fetchZones();
    }
  };

  const handleDelete = async (z: DeliveryZone) => {
    if (!confirm(`Delete "${z.name}"? Drivers assigned to this zone will be unassigned.`)) return;
    const { error } = await supabase.from("delivery_areas").delete().eq("id", z.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Zone deleted");
      refreshZones();
      fetchZones();
    }
  };

  const handleMapConfirm = (r: { address: string; lat: number; lng: number }) => {
    setForm((f) => ({ ...f, lat: r.lat.toFixed(6), lng: r.lng.toFixed(6) }));
    setShowMap(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Delivery Zones
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Each zone has a centre point and a 5km delivery radius. Customers can only order if
            they're inside a zone. Drivers pick which zones they work in.
          </p>
        </div>
        {!creating && (
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New zone
          </button>
        )}
      </div>

      {creating && (
        <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
          <h3 className="font-bold text-foreground">{editing ? "Edit zone" : "Add new zone"}</h3>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Zone name <span className="text-destructive">*</span>
            </label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Mfuleni"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Suburb tag (optional)
            </label>
            <input
              value={form.suburb}
              onChange={(e) => setForm((f) => ({ ...f, suburb: e.target.value }))}
              placeholder="e.g. Cape Town"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Centre latitude
              </label>
              <input
                value={form.lat}
                onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                placeholder="-34.0233"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Centre longitude
              </label>
              <input
                value={form.lng}
                onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                placeholder="18.6781"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            <MapIcon className="h-3.5 w-3.5 text-primary" /> Pick centre on map
          </button>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Radius (km)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="50"
                value={form.radius_km}
                onChange={(e) => setForm((f) => ({ ...f, radius_km: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Delivery fee (R)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={form.delivery_fee}
                onChange={(e) => setForm((f) => ({ ...f, delivery_fee: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={cancelEdit}
              className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-bold text-foreground hover:bg-secondary"
            >
              <X className="inline h-4 w-4 mr-1" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 hover:opacity-90"
            >
              <Check className="inline h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save zone"}
            </button>
          </div>
        </div>
      )}

      {showMap && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border border-border bg-background pt-4 shadow-xl">
            <div className="flex items-center justify-between px-4 pb-2">
              <h3 className="font-display text-base font-bold text-foreground">Pick zone centre</h3>
              <button
                onClick={() => setShowMap(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
                aria-label="Close map"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Suspense
              fallback={
                <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                  Loading map…
                </div>
              }
            >
              <AddressMapPicker
                onConfirm={handleMapConfirm}
                initialAddress={form.name}
                initialCoords={
                  form.lat && form.lng ? { lat: Number(form.lat), lng: Number(form.lng) } : null
                }
              />
            </Suspense>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Loading…</div>
      ) : zones.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-foreground">No delivery zones yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {zones.map((z) => {
            const hasCoords = z.lat != null && z.lng != null;
            return (
              <div
                key={z.id}
                className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                  z.is_active
                    ? "border-border bg-card"
                    : "border-dashed border-muted-foreground/30 bg-muted/20"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground">{z.name}</span>
                    {z.suburb && (
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                        {z.suburb}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      R{z.delivery_fee} · {z.radius_km}km
                    </span>
                    {!z.is_active && (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-destructive">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {hasCoords ? (
                      <>
                        Centre: {z.lat!.toFixed(4)}, {z.lng!.toFixed(4)}
                      </>
                    ) : (
                      <span className="text-amber-600 font-semibold">No centre set</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(z)}
                    title={z.is_active ? "Deactivate" : "Activate"}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    {z.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => startEdit(z)}
                    title="Edit"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(z)}
                    title="Delete"
                    className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminDeliveryAreas;
