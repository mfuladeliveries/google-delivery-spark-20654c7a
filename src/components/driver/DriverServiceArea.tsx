import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MapPin, Save, Crosshair, AlertTriangle, CheckCircle2 } from "lucide-react";
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

const AddressMapPicker = lazy(() => import("@/components/AddressMapPicker"));

interface ServiceArea {
  service_lat: number | null;
  service_lng: number | null;
  service_radius_km: number;
  service_area_label: string;
}

const DriverServiceArea = ({ onSaved }: { onSaved?: () => void }) => {
  const { user } = useAuth();
  const [data, setData] = useState<ServiceArea>({
    service_lat: null,
    service_lng: null,
    service_radius_km: 5,
    service_area_label: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{ centre?: string; radius?: string }>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: row } = await supabase
        .from("driver_profiles")
        .select("service_lat, service_lng, service_radius_km, service_area_label")
        .eq("user_id", user.id)
        .maybeSingle();
      if (row) setData(row as ServiceArea);
      setLoading(false);
    })();
  }, [user]);

  const handleConfirm = (r: { address: string; lat: number; lng: number }) => {
    setData((d) => ({
      ...d,
      service_lat: r.lat,
      service_lng: r.lng,
      service_area_label: d.service_area_label || r.address.split(",").slice(0, 2).join(",").trim(),
    }));
    setErrors((e) => ({ ...e, centre: undefined }));
    setShowPicker(false);
  };

  const validate = (d: ServiceArea) => {
    const next: { centre?: string; radius?: string } = {};
    if (d.service_lat == null || d.service_lng == null) {
      next.centre = "Pick your area centre on the map before saving.";
    } else if (
      Math.abs(d.service_lat) > 90 ||
      Math.abs(d.service_lng) > 180
    ) {
      next.centre = "The selected coordinates are invalid. Please pick again.";
    }
    if (d.service_radius_km == null || Number.isNaN(d.service_radius_km)) {
      next.radius = "Choose a radius between 1 and 20 km.";
    } else if (d.service_radius_km < 1) {
      next.radius = "Radius must be at least 1 km.";
    } else if (d.service_radius_km > 20) {
      next.radius = "Radius cannot exceed 20 km.";
    }
    return next;
  };

  const requestSave = () => {
    const next = validate(data);
    setErrors(next);
    if (next.centre || next.radius) {
      toast.error("Please fix the highlighted fields before saving");
      return;
    }
    setShowConfirm(true);
  };

  const handleSave = async () => {
    if (!user) return;
    setShowConfirm(false);
    setSaving(true);
    const { error } = await supabase
      .from("driver_profiles")
      .update({
        service_lat: data.service_lat,
        service_lng: data.service_lng,
        service_radius_km: data.service_radius_km,
        service_area_label: data.service_area_label,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Working area saved!", {
      description: `${data.service_area_label || "Your area"} • ${data.service_radius_km} km radius — you'll now receive offers in this zone.`,
      icon: <CheckCircle2 className="h-4 w-4 text-primary" />,
      duration: 5000,
    });
    onSaved?.();
  };

  if (loading) return null;

  const isSet = data.service_lat != null && data.service_lng != null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
      <h3 className="font-bold text-foreground flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" /> Working Area
      </h3>
      <p className="text-xs text-muted-foreground">
        You'll only receive offers for orders inside this area. Pick the centre point (e.g. your home or
        township) and how far you're willing to drive from there.
      </p>

      {!isSet && (
        <div className="flex items-start gap-2 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600 mt-0.5" />
          <p className="text-xs text-foreground">
            <span className="font-bold text-amber-700">No working area set.</span> You won't receive any
            delivery offers until you save one.
          </p>
        </div>
      )}

      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Area name (e.g. Mfuleni)</label>
        <input
          value={data.service_area_label}
          onChange={(e) => setData((d) => ({ ...d, service_area_label: e.target.value }))}
          placeholder="Mfuleni, Khayelitsha…"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Centre point</label>
        <button
          onClick={() => setShowPicker(true)}
          aria-invalid={!!errors.centre}
          aria-describedby={errors.centre ? "centre-error" : undefined}
          className={`w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm font-medium text-foreground transition-colors ${
            errors.centre
              ? "border-destructive bg-destructive/5 hover:border-destructive"
              : "border-border hover:border-primary hover:bg-primary/5"
          }`}
        >
          <Crosshair className={`h-4 w-4 ${errors.centre ? "text-destructive" : "text-primary"}`} />
          {isSet
            ? `Pinned: ${data.service_lat!.toFixed(4)}, ${data.service_lng!.toFixed(4)} — tap to change`
            : "Pick your area centre on the map"}
        </button>
        {errors.centre && (
          <p id="centre-error" className="mt-1.5 flex items-start gap-1 text-xs font-medium text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{errors.centre}</span>
          </p>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1 block">
          Working radius: <span className={errors.radius ? "text-destructive" : "text-primary"}>{data.service_radius_km} km</span>
        </label>
        <input
          type="range"
          min={1}
          max={20}
          step={1}
          value={data.service_radius_km}
          onChange={(e) => {
            const v = Number(e.target.value);
            setData((d) => ({ ...d, service_radius_km: v }));
            setErrors((er) => ({ ...er, radius: undefined }));
          }}
          aria-invalid={!!errors.radius}
          aria-describedby={errors.radius ? "radius-error" : undefined}
          className={`w-full ${errors.radius ? "accent-destructive" : "accent-primary"}`}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>1 km</span><span>10 km</span><span>20 km</span>
        </div>
        {errors.radius && (
          <p id="radius-error" className="mt-1.5 flex items-start gap-1 text-xs font-medium text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{errors.radius}</span>
          </p>
        )}
      </div>

      <button
        onClick={requestSave}
        disabled={saving}
        className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-orange flex items-center justify-center gap-2"
      >
        <Save className="h-4 w-4" />
        {saving ? "Saving..." : "Save Working Area"}
      </button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm your working area</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>You'll only receive delivery offers inside this zone:</p>
                <div className="rounded-xl bg-secondary/60 p-3 space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Area</span><span className="font-semibold text-foreground">{data.service_area_label || "Unnamed area"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Centre</span><span className="font-mono text-xs text-foreground">{data.service_lat?.toFixed(4)}, {data.service_lng?.toFixed(4)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Radius</span><span className="font-semibold text-primary">{data.service_radius_km} km</span></div>
                </div>
                <p className="text-xs text-muted-foreground">You can change this anytime from the Area tab.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave}>Confirm & Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showPicker && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border border-border bg-background pt-4 shadow-xl">
            <div className="flex items-center justify-between px-4 pb-2">
              <h3 className="font-display text-base font-bold text-foreground">Pick your working area</h3>
              <button
                onClick={() => setShowPicker(false)}
                className="rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary"
              >
                Close
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
                onConfirm={handleConfirm}
                initialCoords={
                  data.service_lat != null && data.service_lng != null
                    ? { lat: data.service_lat, lng: data.service_lng }
                    : null
                }
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverServiceArea;
