// Admin branch manager: one restaurant brand, many branches, each allocated to
// a delivery area. Customers only see a brand in areas where it has an active
// branch with delivery switched on.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Plus, Save, Trash2, X, Store } from "lucide-react";
import { invalidateCatalog } from "@/lib/catalog";
import type { RestaurantLocation } from "@/lib/restaurantAreas";

interface AreaOption {
  id: string;
  name: string;
  is_active?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
  areas: AreaOption[];
  onSaved?: () => void;
}

type Draft = {
  area_id: string;
  branch_name: string;
  address: string;
  lat: string;
  lng: string;
  delivery_fee: string;
  estimated_delivery_time: string;
  opens_at: string;
  closes_at: string;
};

const emptyDraft: Draft = {
  area_id: "",
  branch_name: "",
  address: "",
  lat: "",
  lng: "",
  delivery_fee: "",
  estimated_delivery_time: "",
  opens_at: "",
  closes_at: "",
};

const RestaurantBranches = ({
  open,
  onClose,
  restaurantId,
  restaurantName,
  areas,
  onSaved,
}: Props) => {
  const [branches, setBranches] = useState<RestaurantLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("restaurant_locations")
      .select(
        "id, restaurant_id, area_id, branch_name, address, lat, lng, active, delivery_enabled, is_open, delivery_fee, estimated_delivery_time, opens_at, closes_at, operating_days",
      )
      .eq("restaurant_id", restaurantId)
      .order("branch_name");
    if (error) toast.error("Could not load branches: " + error.message);
    setBranches((data ?? []) as unknown as RestaurantLocation[]);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open) return null;

  const areaName = (id: string | null) =>
    areas.find((a) => a.id === id)?.name ?? "No area";

  const handleAdd = async () => {
    if (!draft.branch_name.trim()) {
      toast.error("Give the branch a name, e.g. Mfuleni");
      return;
    }
    if (!draft.area_id) {
      toast.error("Choose the delivery area this branch serves");
      return;
    }
    const lat = draft.lat.trim() === "" ? null : Number(draft.lat);
    const lng = draft.lng.trim() === "" ? null : Number(draft.lng);
    if ((lat !== null && !Number.isFinite(lat)) || (lng !== null && !Number.isFinite(lng))) {
      toast.error("Latitude and longitude must be numbers");
      return;
    }

    const fee = draft.delivery_fee.trim() === "" ? null : Number(draft.delivery_fee);
    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) {
      toast.error("Delivery fee must be a positive amount");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("restaurant_locations").insert({
      restaurant_id: restaurantId,
      area_id: draft.area_id,
      branch_name: draft.branch_name.trim(),
      address: draft.address.trim(),
      lat,
      lng,
      delivery_fee: fee,
      estimated_delivery_time: draft.estimated_delivery_time.trim() || null,
      opens_at: draft.opens_at || null,
      closes_at: draft.closes_at || null,
    });
    setSaving(false);
    if (error) {
      toast.error(
        error.code === "23505" || error.message.includes("duplicate key")
          ? "This restaurant already has a branch in that delivery area."
          : "Could not add branch: " + error.message,
      );
      return;
    }
    toast.success(`${draft.branch_name.trim()} added`);
    setDraft(emptyDraft);
    setAdding(false);
    invalidateCatalog();
    await load();
    onSaved?.();
  };

  const patch = async (id: string, values: Record<string, unknown>, label: string) => {
    setBusyId(id);
    const { error } = await supabase.from("restaurant_locations").update(values).eq("id", id);
    setBusyId(null);
    if (error) {
      toast.error("Could not save: " + error.message);
      return;
    }
    toast.success(label);
    invalidateCatalog();
    await load();
    onSaved?.();
  };

  const remove = async (b: RestaurantLocation) => {
    if (!confirm(`Remove the ${b.branch_name || "unnamed"} branch?`)) return;
    setBusyId(b.id);
    const { error } = await supabase.from("restaurant_locations").delete().eq("id", b.id);
    setBusyId(null);
    if (error) {
      toast.error("Could not remove branch: " + error.message);
      return;
    }
    toast.success("Branch removed");
    invalidateCatalog();
    await load();
    onSaved?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-card sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-foreground">
              <Store className="h-4 w-4 text-primary" /> Branches — {restaurantName}
            </h2>
            <p className="text-xs text-muted-foreground">
              Each branch serves one delivery area. Customers see one card per restaurant and
              automatically order from the branch in their area.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading branches…</p>
        ) : (
          <div className="space-y-2">
            {branches.length === 0 && (
              <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                No branches yet. Add one so customers in an area can order.
              </p>
            )}
            {branches.map((b) => (
              <div key={b.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">
                      {b.branch_name || "Unnamed branch"}
                    </p>
                    <p className="text-[11px] text-primary font-semibold">🗺️ {areaName(b.area_id)}</p>
                    {b.address && (
                      <p className="truncate text-[11px] text-muted-foreground">{b.address}</p>
                    )}
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <MapPin className="h-2.5 w-2.5" />
                      {b.lat != null && b.lng != null
                        ? `${b.lat.toFixed(4)}, ${b.lng.toFixed(4)}`
                        : "No coordinates — deliveries blocked"}
                      {b.opens_at && b.closes_at
                        ? ` · ${b.opens_at.slice(0, 5)}–${b.closes_at.slice(0, 5)}`
                        : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(b)}
                    disabled={busyId === b.id}
                    className="rounded-xl p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    title="Remove branch"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    value={b.area_id ?? ""}
                    onChange={(e) =>
                      patch(b.id, { area_id: e.target.value || null }, "Area updated")
                    }
                    disabled={busyId === b.id}
                    className="rounded-xl border border-border bg-card px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  >
                    <option value="">— No area —</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.is_active === false ? " (inactive)" : ""}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={b.active}
                        disabled={busyId === b.id}
                        onChange={(e) =>
                          patch(
                            b.id,
                            { active: e.target.checked },
                            e.target.checked ? "Branch switched on" : "Branch switched off",
                          )
                        }
                      />
                      Visible
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={b.delivery_enabled}
                        disabled={busyId === b.id}
                        onChange={(e) =>
                          patch(
                            b.id,
                            { delivery_enabled: e.target.checked },
                            e.target.checked ? "Delivery switched on" : "Delivery switched off",
                          )
                        }
                      />
                      Delivering
                    </label>
                  </div>
                </div>

                <BranchDetailEditor
                  branch={b}
                  busy={busyId === b.id}
                  onSave={(values) => patch(b.id, values, "Branch details saved")}
                />
              </div>
            ))}
          </div>
        )}

        {/* Add branch */}
        {adding ? (
          <div className="mt-3 space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-bold text-foreground">New branch</p>
            <input
              value={draft.branch_name}
              onChange={(e) => setDraft({ ...draft, branch_name: e.target.value })}
              placeholder="Branch name, e.g. Mfuleni"
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <select
              value={draft.area_id}
              onChange={(e) => setDraft({ ...draft, area_id: e.target.value })}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">— Choose delivery area —</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.is_active === false ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            <input
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              placeholder="Street address"
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={draft.lat}
                onChange={(e) => setDraft({ ...draft, lat: e.target.value })}
                placeholder="Latitude"
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <input
                value={draft.lng}
                onChange={(e) => setDraft({ ...draft, lng: e.target.value })}
                placeholder="Longitude"
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                value={draft.opens_at}
                onChange={(e) => setDraft({ ...draft, opens_at: e.target.value })}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <input
                type="time"
                value={draft.closes_at}
                onChange={(e) => setDraft({ ...draft, closes_at: e.target.value })}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Leave the times empty to use the restaurant's own opening hours.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={saving}
                className="btn-glow flex-1 rounded-xl gradient-maroon py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                <Save className="mr-1 inline h-3 w-3" />
                {saving ? "Adding…" : "Add branch"}
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setDraft(emptyDraft);
                }}
                className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 py-2.5 text-xs font-bold text-primary hover:bg-primary/5"
          >
            <Plus className="h-3.5 w-3.5" /> Add branch
          </button>
        )}
      </div>
    </div>
  );
};

// Inline editor for a branch's address, coordinates and hours.
const BranchDetailEditor = ({
  branch,
  busy,
  onSave,
}: {
  branch: RestaurantLocation;
  busy: boolean;
  onSave: (values: Record<string, unknown>) => void;
}) => {
  const [openEditor, setOpenEditor] = useState(false);
  const [name, setName] = useState(branch.branch_name ?? "");
  const [address, setAddress] = useState(branch.address ?? "");
  const [lat, setLat] = useState(branch.lat != null ? String(branch.lat) : "");
  const [lng, setLng] = useState(branch.lng != null ? String(branch.lng) : "");
  const [opens, setOpens] = useState(branch.opens_at ? branch.opens_at.slice(0, 5) : "");
  const [closes, setCloses] = useState(branch.closes_at ? branch.closes_at.slice(0, 5) : "");

  if (!openEditor) {
    return (
      <button
        onClick={() => setOpenEditor(true)}
        className="mt-2 text-[11px] font-semibold text-primary hover:underline"
      >
        Edit address, coordinates &amp; hours
      </button>
    );
  }

  const save = () => {
    const latNum = lat.trim() === "" ? null : Number(lat);
    const lngNum = lng.trim() === "" ? null : Number(lng);
    if ((latNum !== null && !Number.isFinite(latNum)) || (lngNum !== null && !Number.isFinite(lngNum))) {
      toast.error("Latitude and longitude must be numbers");
      return;
    }
    onSave({
      branch_name: name.trim(),
      address: address.trim(),
      lat: latNum,
      lng: lngNum,
      opens_at: opens || null,
      closes_at: closes || null,
    });
    setOpenEditor(false);
  };

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-border bg-card p-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Branch name"
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
      />
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Street address"
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="Latitude"
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
        />
        <input
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="Longitude"
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="time"
          value={opens}
          onChange={(e) => setOpens(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
        />
        <input
          type="time"
          value={closes}
          onChange={(e) => setCloses(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="btn-glow flex-1 rounded-lg gradient-maroon py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save branch"}
        </button>
        <button
          onClick={() => setOpenEditor(false)}
          className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default RestaurantBranches;
