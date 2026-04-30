import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MapPin, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeliveryArea {
  id: string;
  name: string;
  suburb: string;
}

const DriverServiceArea = ({ onSaved }: { onSaved?: () => void }) => {
  const { user } = useAuth();
  const [areas, setAreas] = useState<DeliveryArea[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [originalId, setOriginalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: areaRows }, { data: profileRow }] = await Promise.all([
        supabase
          .from("delivery_areas")
          .select("id, name, suburb")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("driver_profiles")
          .select("service_area_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      setAreas(areaRows || []);
      const id = (profileRow?.service_area_id as string | null) ?? null;
      setSelectedId(id);
      setOriginalId(id);
      setLoading(false);
    })();
  }, [user]);

  const isDirty = selectedId !== originalId;
  const selectedArea = areas.find((a) => a.id === selectedId) || null;

  const requestSave = () => {
    if (!selectedId) {
      toast.error("Pick an area before saving");
      return;
    }
    setShowConfirm(true);
  };

  const handleSave = async () => {
    if (!user || !selectedId) return;
    setShowConfirm(false);
    setSaving(true);
    const { error } = await supabase
      .from("driver_profiles")
      .update({ service_area_id: selectedId })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOriginalId(selectedId);
    toast.success("Working area saved!", {
      description: `${selectedArea?.name} — you'll now receive offers in this area.`,
      icon: <CheckCircle2 className="h-4 w-4 text-primary" />,
      duration: 5000,
    });
    onSaved?.();
  };

  if (loading) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
      <h3 className="font-bold text-foreground flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" /> Working Area
      </h3>
      <p className="text-xs text-muted-foreground">
        Pick the township or suburb you want to work in. You'll only receive offers for orders in
        that area. You can change it anytime.
      </p>

      {areas.length === 0 ? (
        <div className="flex items-start gap-2 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600 mt-0.5" />
          <p className="text-xs text-foreground">
            <span className="font-bold text-amber-700">No delivery areas available yet.</span> An
            admin needs to add areas before you can pick one.
          </p>
        </div>
      ) : (
        <>
          {!selectedId && (
            <div className="flex items-start gap-2 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-3">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600 mt-0.5" />
              <p className="text-xs text-foreground">
                <span className="font-bold text-amber-700">No working area set.</span> You won't
                receive any delivery offers until you pick one below.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {areas.map((a) => {
              const active = selectedId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  aria-pressed={active}
                  className={`w-full text-left rounded-xl border-2 p-3 transition-all flex items-center justify-between gap-2 ${
                    active
                      ? "border-primary bg-primary/10 shadow-orange"
                      : "border-border bg-background hover:border-primary/50 hover:bg-primary/5"
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`font-bold ${active ? "text-primary" : "text-foreground"}`}>
                      {a.name}
                    </p>
                    {a.suburb && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{a.suburb}</p>
                    )}
                  </div>
                  <div
                    className={`h-5 w-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
                      active ? "border-primary bg-primary" : "border-border"
                    }`}
                  >
                    {active && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={requestSave}
            disabled={saving || !isDirty || !selectedId}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.01] active:scale-[0.99] shadow-orange flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : isDirty ? "Save Working Area" : "Saved"}
          </button>
        </>
      )}

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm your working area</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>You'll only receive delivery offers in this area:</p>
                <div className="rounded-xl bg-secondary/60 p-3">
                  <p className="font-bold text-foreground">{selectedArea?.name}</p>
                  {selectedArea?.suburb && (
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedArea.suburb}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  You can change this anytime from the Area tab.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave}>Confirm & Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DriverServiceArea;
