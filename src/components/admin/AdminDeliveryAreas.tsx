import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Plus, Pencil, Trash2, X, Check, Power, PowerOff } from "lucide-react";

interface DeliveryArea {
  id: string;
  name: string;
  suburb: string;
  is_active: boolean;
  created_at: string;
}

const AdminDeliveryAreas = () => {
  const [areas, setAreas] = useState<DeliveryArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DeliveryArea | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", suburb: "" });
  const [saving, setSaving] = useState(false);

  const fetchAreas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("delivery_areas")
      .select("id, name, suburb, is_active, created_at")
      .order("name");
    if (error) {
      toast.error(error.message);
    } else {
      setAreas(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAreas();
  }, []);

  const startCreate = () => {
    setForm({ name: "", suburb: "" });
    setEditing(null);
    setCreating(true);
  };

  const startEdit = (a: DeliveryArea) => {
    setForm({ name: a.name, suburb: a.suburb });
    setEditing(a);
    setCreating(true);
  };

  const cancelEdit = () => {
    setCreating(false);
    setEditing(null);
    setForm({ name: "", suburb: "" });
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const suburb = form.suburb.trim();
    if (!name) {
      toast.error("Area name is required");
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("delivery_areas")
        .update({ name, suburb })
        .eq("id", editing.id);
      if (error) toast.error(error.message);
      else toast.success("Area updated");
    } else {
      const { error } = await supabase
        .from("delivery_areas")
        .insert({ name, suburb });
      if (error) toast.error(error.message);
      else toast.success("Area created");
    }
    setSaving(false);
    cancelEdit();
    fetchAreas();
  };

  const toggleActive = async (a: DeliveryArea) => {
    const { error } = await supabase
      .from("delivery_areas")
      .update({ is_active: !a.is_active })
      .eq("id", a.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(a.is_active ? "Area deactivated" : "Area activated");
      fetchAreas();
    }
  };

  const handleDelete = async (a: DeliveryArea) => {
    if (!confirm(`Delete "${a.name}"? Drivers assigned to this area will be cleared.`)) return;
    const { error } = await supabase.from("delivery_areas").delete().eq("id", a.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Area deleted");
      fetchAreas();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Delivery Areas
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Add the townships and suburbs where you offer delivery. Drivers pick one to work in.
          </p>
        </div>
        {!creating && (
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New area
          </button>
        )}
      </div>

      {creating && (
        <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
          <h3 className="font-bold text-foreground">{editing ? "Edit area" : "Add new area"}</h3>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Area name <span className="text-destructive">*</span>
            </label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Mfuleni"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              This name is matched against the customer's address to route orders to the right driver.
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Suburb tag (optional)
            </label>
            <input
              value={form.suburb}
              onChange={(e) => setForm((f) => ({ ...f, suburb: e.target.value }))}
              placeholder="e.g. Khayelitsha"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              An additional keyword to match (e.g. broader township the area belongs to).
            </p>
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
              <Check className="inline h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save area"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Loading…</div>
      ) : areas.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-foreground">No delivery areas yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add your first area so drivers can start picking where they work.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {areas.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                a.is_active ? "border-border bg-card" : "border-dashed border-muted-foreground/30 bg-muted/20"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground">{a.name}</span>
                  {a.suburb && (
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                      {a.suburb}
                    </span>
                  )}
                  {!a.is_active && (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-destructive">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleActive(a)}
                  title={a.is_active ? "Deactivate" : "Activate"}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  {a.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => startEdit(a)}
                  title="Edit"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(a)}
                  title="Delete"
                  className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDeliveryAreas;
