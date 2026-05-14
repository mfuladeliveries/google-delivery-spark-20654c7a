import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { AddressAutocomplete, type ValidatedAddress } from "@/components/AddressAutocomplete";
import { findNearestZone, OUT_OF_ZONE_MESSAGE, type DeliveryZone } from "@/lib/serviceArea";
import type { SavedAddress, SavedAddressInput } from "@/hooks/useCustomerAddresses";

const AddressMapPicker = lazy(() => import("@/components/AddressMapPicker"));

interface SavedAddressDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: SavedAddressInput) => Promise<void> | void;
  zones: DeliveryZone[];
  initial?: SavedAddress | null;
}

const LABEL_PRESETS = ["Home", "Work", "Other"] as const;

export const SavedAddressDialog = ({
  open,
  onClose,
  onSave,
  zones,
  initial,
}: SavedAddressDialogProps) => {
  const [label, setLabel] = useState<string>(initial?.label ?? "Home");
  const [address, setAddress] = useState<string>(initial?.address ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial && typeof initial.lat === "number" && typeof initial.lng === "number"
      ? { lat: initial.lat, lng: initial.lng }
      : null,
  );
  const [verified, setVerified] = useState<boolean>(!!initial);
  const [isDefault, setIsDefault] = useState<boolean>(initial?.is_default ?? false);
  const [showMap, setShowMap] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset state when reopened.
  useEffect(() => {
    if (!open) return;
    setLabel(initial?.label ?? "Home");
    setAddress(initial?.address ?? "");
    setCoords(
      initial && typeof initial.lat === "number" && typeof initial.lng === "number"
        ? { lat: initial.lat, lng: initial.lng }
        : null,
    );
    setVerified(!!initial);
    setIsDefault(initial?.is_default ?? false);
    setShowMap(false);
    setSaving(false);
  }, [open, initial]);

  const zoneMatch = useMemo(
    () => (coords ? findNearestZone(coords.lat, coords.lng, zones) : null),
    [coords, zones],
  );
  const outOfRange = !!coords && zoneMatch === null;

  const handleSelect = (r: ValidatedAddress) => {
    setAddress(r.address);
    setCoords({ lat: r.lat, lng: r.lng });
    setVerified(true);
  };

  const handleText = (t: string) => {
    setAddress(t);
    if (verified) {
      setCoords(null);
      setVerified(false);
    }
  };

  const handleMapConfirm = (r: { address: string; lat: number; lng: number }) => {
    setAddress(r.address);
    setCoords({ lat: r.lat, lng: r.lng });
    setVerified(true);
    setShowMap(false);
  };

  const canSave = verified && !!coords && !outOfRange && !!label.trim();

  const handleSave = async () => {
    if (!canSave || !coords) {
      toast.error("Please select a valid address from the list.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        label: label.trim(),
        address: address.trim(),
        lat: coords.lat,
        lng: coords.lng,
        area_id: zoneMatch?.zone.id ?? null,
        is_default: isDefault,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 z-[70] mx-auto max-w-lg -translate-y-1/2 rounded-3xl border border-border bg-background shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-bold text-foreground">
            {initial ? "Edit address" : "Add a new address"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Label */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Label
            </label>
            <div className="flex flex-wrap gap-2">
              {LABEL_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setLabel(p)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                    label === p
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-secondary"
                  }`}
                >
                  {p}
                </button>
              ))}
              <input
                value={LABEL_PRESETS.includes(label as (typeof LABEL_PRESETS)[number]) ? "" : label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Custom label"
                maxLength={40}
                className="flex-1 min-w-[120px] rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Address autocomplete */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Delivery address
            </label>
            <AddressAutocomplete
              value={address}
              onSelect={handleSelect}
              onTextChange={handleText}
              hasValidSelection={verified}
              placeholder="Start typing your address…"
            />
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <MapPin className="h-3.5 w-3.5" />
              Pick on map & confirm location
            </button>
          </div>

          {/* Verified / out-of-zone state */}
          {verified && coords && !outOfRange && zoneMatch && (
            <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <Check className="mt-0.5 h-4 w-4 text-primary" />
              <div className="text-xs">
                <p className="font-bold text-primary">Inside {zoneMatch.zone.name}</p>
                <p className="mt-0.5 text-muted-foreground break-words">{address}</p>
              </div>
            </div>
          )}

          {verified && outOfRange && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/10 p-3"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <p className="text-xs font-bold text-destructive">
                Sorry, we do not deliver to this location yet.
              </p>
            </div>
          )}

          {!verified && address.trim().length > 0 && (
            <p className="text-xs text-muted-foreground">
              Please select a valid address from the list.
            </p>
          )}

          {/* Default toggle */}
          <label className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
            <span className="text-sm font-semibold text-foreground">Set as default address</span>
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-full border border-border bg-card py-3 text-sm font-bold text-foreground hover:bg-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saving}
              className="flex-1 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : initial ? (
                "Save changes"
              ) : (
                "Save address"
              )}
            </button>
          </div>
        </div>
      </div>

      {showMap && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/70" onClick={() => setShowMap(false)} />
          <div className="fixed inset-x-2 top-1/2 z-[80] mx-auto max-w-lg -translate-y-1/2 rounded-3xl border border-border bg-background shadow-xl max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="font-bold text-foreground">Pick location on map</h3>
              <button
                onClick={() => setShowMap(false)}
                className="rounded-full p-1.5 hover:bg-secondary"
                aria-label="Close map"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto py-3">
              <Suspense
                fallback={
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                }
              >
                <AddressMapPicker
                  initialAddress={address}
                  initialCoords={coords}
                  onConfirm={handleMapConfirm}
                />
              </Suspense>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default SavedAddressDialog;
