import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Briefcase, ChevronRight, Home, MapPin, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import AddressMapPicker from "@/components/AddressMapPicker";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
// Distance-based service area is enforced server-side; this sheet just collects an address + GPS pin.

interface UpdateAddressSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save so the caller can refetch the address. */
  onSaved?: () => void;
}

type View = "choice" | "manual" | "map";
type LabelOption = "Home" | "Work" | "Other";

const SUBURB_SUGGESTIONS = ["Mfuleni", "Bluedowns", "Bardale Village", "Bosasa", "Belladonna", "Eerste River", "Summerville", "Blackheath"];
const LANDMARK_MAX = 200;

const LABEL_OPTIONS: { value: LabelOption; icon: typeof Home; emoji: string }[] = [
  { value: "Home", icon: Home, emoji: "🏠" },
  { value: "Work", icon: Briefcase, emoji: "💼" },
  { value: "Other", icon: MapPin, emoji: "📍" },
];

export const UpdateAddressSheet = ({ open, onOpenChange, onSaved }: UpdateAddressSheetProps) => {
  const { user } = useAuth();
  const [view, setView] = useState<View>("choice");

  // Manual form state
  const [street, setStreet] = useState("");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState("Cape Town");
  const [landmark, setLandmark] = useState("");
  const [label, setLabel] = useState<LabelOption>("Home");
  const [setDefault, setSetDefault] = useState(true);
  const [showSuburbSuggestions, setShowSuburbSuggestions] = useState(false);
  const [errors, setErrors] = useState<{ street?: string; suburb?: string; city?: string }>({});
  const [saving, setSaving] = useState(false);

  // Reset to choice view whenever the sheet closes.
  useEffect(() => {
    if (!open) {
      // small delay so it doesn't flicker mid-close
      const t = setTimeout(() => {
        setView("choice");
        setErrors({});
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filteredSuburbs = useMemo(() => {
    const q = suburb.trim().toLowerCase();
    if (!q) return SUBURB_SUGGESTIONS;
    return SUBURB_SUGGESTIONS.filter((s) => s.toLowerCase().includes(q));
  }, [suburb]);

  const composedAddress = useMemo(() => {
    const parts = [street.trim(), suburb.trim(), city.trim()].filter(Boolean);
    const base = parts.join(", ");
    return landmark.trim() ? `${base} (${landmark.trim()})` : base;
  }, [street, suburb, city, landmark]);

  const validate = () => {
    const next: typeof errors = {};
    if (street.trim().length < 5) next.street = "Please enter your street address";
    if (!suburb.trim()) next.suburb = "Suburb is required";
    if (!city.trim()) next.city = "City is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!user) {
      toast.error("Please sign in to save your address");
      return;
    }
    setSaving(true);
    try {
      // Try to forward-geocode the typed address so we get GPS coords too.
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(composedAddress)}&format=json&limit=1&countrycodes=za`,
          { headers: { Accept: "application/json" } },
        );
        const data = await res.json();
        if (Array.isArray(data) && data[0]) {
          lat = parseFloat(data[0].lat);
          lng = parseFloat(data[0].lon);
        }
      } catch { /* fall back to address-only save */ }

      const { error } = await supabase
        .from("profiles")
        .update({ address: composedAddress, lat, lng })
        .eq("user_id", user.id);
      if (error) throw error;

      if (lat === null || lng === null) {
        toast.warning("Address saved, but we couldn't pinpoint it on the map. Use 'Pick on map' for an exact GPS pin.");
      } else {
        toast.success("Address saved");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save address";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleMapConfirm = async ({ address, lat, lng }: { address: string; lat: number; lng: number }) => {
    if (!user) {
      toast.error("Please sign in to save your address");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ address, lat, lng })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Address saved");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save address";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        {view === "choice" ? (
          <>
            <DrawerHeader className="text-left">
              <DrawerTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-primary" />
                Update Delivery Address
              </DrawerTitle>
              <DrawerDescription>How would you like to enter your address?</DrawerDescription>
            </DrawerHeader>
            <div className="space-y-3 px-4 pb-6">
              <button
                type="button"
                onClick={() => setView("map")}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Search className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">Search on map</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Drop a pin or use your current location
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              </button>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  or
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <button
                type="button"
                onClick={() => setView("manual")}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Pencil className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">Enter address manually</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Type your street, suburb & landmark
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              </button>
            </div>
          </>
        ) : view === "map" ? (
          <>
            <DrawerHeader className="flex flex-row items-center gap-2 text-left">
              <button
                type="button"
                onClick={() => setView("choice")}
                className="-ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <DrawerTitle className="text-lg">Pick on map</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto pb-2">
              <AddressMapPicker onConfirm={handleMapConfirm} />
            </div>
          </>
        ) : (
          <>
            <DrawerHeader className="flex flex-row items-center gap-2 text-left">
              <button
                type="button"
                onClick={() => setView("choice")}
                className="-ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <DrawerTitle className="text-lg">Enter Address</DrawerTitle>
            </DrawerHeader>

            <div className="space-y-4 overflow-y-auto px-4 pb-6">
              {/* Street */}
              <div className="space-y-1.5">
                <Label htmlFor="addr-street" className="text-xs font-semibold text-foreground">
                  Street Number & Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="addr-street"
                  placeholder="e.g. 12 Mfuleni Drive"
                  value={street}
                  maxLength={100}
                  onChange={(e) => setStreet(e.target.value)}
                  className={cn(errors.street && "border-destructive focus-visible:ring-destructive")}
                />
                {errors.street && (
                  <p className="text-xs font-medium text-destructive">{errors.street}</p>
                )}
              </div>

              {/* Suburb */}
              <div className="relative space-y-1.5">
                <Label htmlFor="addr-suburb" className="text-xs font-semibold text-foreground">
                  Suburb / Area <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="addr-suburb"
                  placeholder="e.g. Mfuleni"
                  value={suburb}
                  maxLength={80}
                  onChange={(e) => {
                    setSuburb(e.target.value);
                    setShowSuburbSuggestions(true);
                  }}
                  onFocus={() => setShowSuburbSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuburbSuggestions(false), 150)}
                  className={cn(errors.suburb && "border-destructive focus-visible:ring-destructive")}
                />
                {showSuburbSuggestions && filteredSuburbs.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
                    {filteredSuburbs.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSuburb(s);
                          setShowSuburbSuggestions(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                      >
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {errors.suburb && (
                  <p className="text-xs font-medium text-destructive">{errors.suburb}</p>
                )}
                {suburbOutsideZone && !errors.suburb && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-[11px] font-medium text-destructive">
                    ⚠️ &ldquo;{suburb.trim()}&rdquo; may be outside our delivery area. You can save it
                    but delivery may not be available.
                  </p>
                )}
              </div>

              {/* City */}
              <div className="space-y-1.5">
                <Label htmlFor="addr-city" className="text-xs font-semibold text-foreground">
                  City <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="addr-city"
                  placeholder="Cape Town"
                  value={city}
                  maxLength={80}
                  onChange={(e) => setCity(e.target.value)}
                  className={cn(errors.city && "border-destructive focus-visible:ring-destructive")}
                />
                {errors.city && <p className="text-xs font-medium text-destructive">{errors.city}</p>}
              </div>

              {/* Landmark */}
              <div className="space-y-1.5">
                <Label htmlFor="addr-landmark" className="text-xs font-semibold text-foreground">
                  Landmark / Directions{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="addr-landmark"
                  placeholder="e.g. Next to Spar, blue gate, 2nd house from the corner..."
                  value={landmark}
                  maxLength={LANDMARK_MAX}
                  rows={3}
                  onChange={(e) => setLandmark(e.target.value.slice(0, LANDMARK_MAX))}
                />
                <p className="text-right text-[10px] text-muted-foreground">
                  {landmark.length}/{LANDMARK_MAX}
                </p>
              </div>

              {/* Label pills */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Address Label</Label>
                <div className="flex flex-wrap gap-2">
                  {LABEL_OPTIONS.map(({ value, icon: Icon, emoji }) => {
                    const active = label === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLabel(value)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-muted text-foreground hover:bg-muted/70",
                        )}
                      >
                        <span aria-hidden>{emoji}</span>
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Default switch */}
              <label className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-bold text-foreground">Set as default address</p>
                  <p className="text-[11px] text-muted-foreground">Used for new orders by default</p>
                </div>
                <Switch checked={setDefault} onCheckedChange={setSetDefault} />
              </label>

              {/* Delivery area hint */}
              <div className="rounded-2xl border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                <p className="font-bold text-foreground">⚠️ Delivery Area Check</p>
                <p className="mt-1">
                  We deliver to: <span className="font-semibold text-foreground">{ALL_DELIVERY_AREAS}</span>.
                </p>
              </div>

              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-12 w-full rounded-full text-sm font-bold"
              >
                {saving ? "Saving..." : "Save Address"}
              </Button>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};

export default UpdateAddressSheet;
