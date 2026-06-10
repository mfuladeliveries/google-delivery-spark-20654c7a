import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Plus, Pencil, Trash2, X, Check, Power, PowerOff, History } from "lucide-react";

interface PeakWindow {
  id: string;
  label: string;
  day_of_week: number | null;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  flat_amount: number;
  is_active: boolean;
}

interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_by_email: string | null;
  created_at: string;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const blankForm = {
  label: "",
  day_of_week: "" as string, // "" = every day, otherwise "0".."6"
  start_time: "17:00",
  end_time: "20:00",
  flat_amount: "10",
  is_active: true,
};

const fmtTime = (t: string) => (t ? t.slice(0, 5) : "");

const AdminFeeManagement = () => {
  const [windows, setWindows] = useState<PeakWindow[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [currentSurcharge, setCurrentSurcharge] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PeakWindow | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [w, a, s] = await Promise.all([
      supabase
        .from("peak_surcharge_windows")
        .select("id, label, day_of_week, start_time, end_time, flat_amount, is_active")
        .order("start_time"),
      supabase
        .from("fee_audit_log")
        .select("id, entity_type, entity_id, action, old_values, new_values, changed_by_email, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.rpc("current_peak_surcharge"),
    ]);
    if (w.error) toast.error(w.error.message);
    else setWindows((w.data || []) as PeakWindow[]);
    if (!a.error) setAudit((a.data || []) as AuditEntry[]);
    if (!s.error) setCurrentSurcharge(Number(s.data) || 0);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(() => {
      supabase.rpc("current_peak_surcharge").then(({ data }) => {
        setCurrentSurcharge(Number(data) || 0);
      });
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const startCreate = () => {
    setForm(blankForm);
    setEditing(null);
    setCreating(true);
  };

  const startEdit = (w: PeakWindow) => {
    setForm({
      label: w.label,
      day_of_week: w.day_of_week == null ? "" : String(w.day_of_week),
      start_time: fmtTime(w.start_time),
      end_time: fmtTime(w.end_time),
      flat_amount: String(w.flat_amount),
      is_active: w.is_active,
    });
    setEditing(w);
    setCreating(true);
  };

  const cancel = () => {
    setCreating(false);
    setEditing(null);
    setForm(blankForm);
  };

  const handleSave = async () => {
    const label = form.label.trim();
    if (!label) return toast.error("Label is required");
    const amount = Number(form.flat_amount);
    if (!Number.isFinite(amount) || amount < 0) return toast.error("Amount must be 0 or more");
    if (!form.start_time || !form.end_time) return toast.error("Start and end time are required");

    setSaving(true);
    const payload = {
      label,
      day_of_week: form.day_of_week === "" ? null : Number(form.day_of_week),
      start_time: form.start_time,
      end_time: form.end_time,
      flat_amount: amount,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("peak_surcharge_windows").update(payload).eq("id", editing.id)
      : await supabase.from("peak_surcharge_windows").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Peak window updated" : "Peak window created");
    cancel();
    load();
  };

  const toggle = async (w: PeakWindow) => {
    const { error } = await supabase
      .from("peak_surcharge_windows")
      .update({ is_active: !w.is_active })
      .eq("id", w.id);
    if (error) return toast.error(error.message);
    toast.success(w.is_active ? "Window deactivated" : "Window activated");
    load();
  };

  const remove = async (w: PeakWindow) => {
    if (!confirm(`Delete "${w.label}"?`)) return;
    const { error } = await supabase.from("peak_surcharge_windows").delete().eq("id", w.id);
    if (error) return toast.error(error.message);
    toast.success("Window deleted");
    load();
  };

  const describeChange = (e: AuditEntry): string => {
    if (e.entity_type === "peak_window") {
      const label =
        (e.new_values?.label as string) || (e.old_values?.label as string) || "peak window";
      if (e.action === "insert") return `Created peak window “${label}”`;
      if (e.action === "delete") return `Deleted peak window “${label}”`;
      const oldAmt = Number(e.old_values?.flat_amount ?? 0);
      const newAmt = Number(e.new_values?.flat_amount ?? 0);
      if (oldAmt !== newAmt) return `“${label}” amount R${oldAmt} → R${newAmt}`;
      return `Edited peak window “${label}”`;
    }
    if (e.entity_type === "delivery_area") {
      const name =
        (e.new_values?.name as string) || (e.old_values?.name as string) || "zone";
      if (e.action === "insert") return `Created delivery zone “${name}”`;
      if (e.action === "delete") return `Deleted delivery zone “${name}”`;
      const oldBase = Number(e.old_values?.base_fee ?? 0);
      const newBase = Number(e.new_values?.base_fee ?? 0);
      const oldPer = Number(e.old_values?.price_per_km ?? 0);
      const newPer = Number(e.new_values?.price_per_km ?? 0);
      if (oldBase !== newBase || oldPer !== newPer) {
        return `“${name}” pricing R${oldBase}+R${oldPer}/km → R${newBase}+R${newPer}/km`;
      }
      return `Edited delivery zone “${name}”`;
    }
    return `${e.action} on ${e.entity_type}`;
  };

  return (
    <div className="space-y-6">
      {/* Current surcharge banner */}
      <div
        className={`rounded-2xl border-2 p-4 ${
          currentSurcharge > 0
            ? "border-primary/40 bg-primary/10"
            : "border-border bg-card"
        }`}
      >
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Right now in Africa/Johannesburg
            </p>
            <p className="text-base font-bold text-foreground">
              {currentSurcharge > 0
                ? `+R${currentSurcharge.toFixed(2)} surcharge active`
                : "No surcharge active"}
            </p>
          </div>
        </div>
      </div>

      {/* Peak windows */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-foreground">Peak-time surcharges</h3>
            <p className="text-xs text-muted-foreground">
              Flat rand amount added to every delivery during the window. Multiple active windows
              stack.
            </p>
          </div>
          {!creating && (
            <button
              onClick={startCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> New window
            </button>
          )}
        </div>

        {creating && (
          <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
            <h4 className="font-bold text-foreground">
              {editing ? "Edit peak window" : "Add peak window"}
            </h4>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Label <span className="text-destructive">*</span>
              </label>
              <input
                autoFocus
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Friday dinner rush"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Day of week
              </label>
              <select
                value={form.day_of_week}
                onChange={(e) => setForm((f) => ({ ...f, day_of_week: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="">Every day</option>
                {DOW_LABELS.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Start time
                </label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  End time
                </label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Surcharge amount (R) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.flat_amount}
                onChange={(e) => setForm((f) => ({ ...f, flat_amount: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
              Active
            </label>
            <div className="flex gap-2">
              <button
                onClick={cancel}
                className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-bold text-foreground hover:bg-secondary"
              >
                <X className="inline h-4 w-4 mr-1" /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.label.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 hover:opacity-90"
              >
                <Check className="inline h-4 w-4 mr-1" />{" "}
                {saving ? "Saving…" : "Save window"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-6 text-sm text-muted-foreground">Loading…</div>
        ) : windows.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-foreground">No peak windows yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add a window to add a flat surcharge during busy hours.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {windows.map((w) => (
              <div
                key={w.id}
                className={`rounded-xl border p-3 flex items-start justify-between gap-3 ${
                  w.is_active
                    ? "border-border bg-card"
                    : "border-dashed border-muted-foreground/30 bg-muted/20"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground">{w.label}</span>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      +R{Number(w.flat_amount).toFixed(2)}
                    </span>
                    {!w.is_active && (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-destructive">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {w.day_of_week == null ? "Every day" : DOW_LABELS[w.day_of_week]} ·{" "}
                    {fmtTime(w.start_time)}–{fmtTime(w.end_time)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggle(w)}
                    title={w.is_active ? "Deactivate" : "Activate"}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    {w.is_active ? (
                      <PowerOff className="h-4 w-4" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => startEdit(w)}
                    title="Edit"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(w)}
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
      </section>

      {/* Audit log */}
      <section className="space-y-3">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Fee change history
          </h3>
          <p className="text-xs text-muted-foreground">
            Last 50 changes to delivery zones and peak windows.
          </p>
        </div>
        {audit.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No changes recorded yet.
          </div>
        ) : (
          <div className="space-y-1.5">
            {audit.map((e) => (
              <div
                key={e.id}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
              >
                <p className="font-semibold text-foreground">{describeChange(e)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(e.created_at).toLocaleString("en-ZA", {
                    timeZone: "Africa/Johannesburg",
                  })}{" "}
                  · {e.changed_by_email || "system"} · {e.action}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminFeeManagement;
