import type { ValidatedAddress } from "@/components/AddressAutocomplete";

/** Only home-page selections already bound to map coordinates are stored here. */
export function readHomeDeliveryAddress(): ValidatedAddress | null {
  try {
    const raw = sessionStorage.getItem("mfula-manual-area-v1");
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const { address, lat, lng } = value as Record<string, unknown>;
    if (
      typeof address !== "string" || !address.trim() ||
      typeof lat !== "number" || !Number.isFinite(lat) || Math.abs(lat) > 90 ||
      typeof lng !== "number" || !Number.isFinite(lng) || Math.abs(lng) > 180
    ) return null;
    return { address, lat, lng };
  } catch {
    return null;
  }
}